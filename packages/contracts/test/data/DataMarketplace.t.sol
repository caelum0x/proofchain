// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { DataMarketplace } from "../../src/data/DataMarketplace.sol";
import { FeeManager } from "../../src/payments/FeeManager.sol";
import { Treasury } from "../../src/payments/Treasury.sol";
import { StablecoinRegistry } from "../../src/payments/StablecoinRegistry.sol";
import { OrganizationRegistry } from "../../src/identity/OrganizationRegistry.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { IDataMarketplace } from "../../src/interfaces/IDataMarketplace.sol";
import { IOrganizationRegistry } from "../../src/interfaces/IOrganizationRegistry.sol";

/// @dev Malicious ERC20 that re-enters DataMarketplace.purchase on its payout transfer.
contract ReentrantMarketToken is ERC20 {
    DataMarketplace public market;
    bytes32 public listingId;
    bool public armed;

    constructor() ERC20("Reentrant", "RE") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(DataMarketplace market_, bytes32 listingId_) external {
        market = market_;
        listingId = listingId_;
        armed = true;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (armed) {
            armed = false;
            market.purchase(listingId);
        }
        return super.transfer(to, value);
    }
}

contract DataMarketplaceTest is Test {
    AddressBook internal book;
    DataMarketplace internal market;
    FeeManager internal feeManager;
    Treasury internal treasury;
    StablecoinRegistry internal stablecoins;
    OrganizationRegistry internal orgs;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal provider = address(0x9401DE2);
    address internal buyer = address(0xB0B);

    bytes32 internal constant L1 = keccak256("listing-1");
    bytes32 internal constant ORG = keccak256("org-1");
    bytes32 internal constant CONTENT = keccak256("content");
    bytes32 internal constant FEE_ACTION = keccak256("DATA_ACCESS");

    uint256 internal constant PRICE = 1_000e6;

    event Listed(bytes32 indexed listingId, address indexed provider, address token, uint256 price, uint32 accessDays);
    event AccessPurchased(bytes32 indexed listingId, address indexed buyer, uint256 price, uint64 expiresAt);

    function setUp() public {
        book = new AddressBook(admin);
        market = new DataMarketplace(address(book), admin);
        feeManager = new FeeManager(address(book), admin);
        treasury = new Treasury(address(book), admin);
        stablecoins = new StablecoinRegistry(address(book), admin);
        orgs = new OrganizationRegistry(address(book), admin);
        usdc = new MockUSDC();

        vm.startPrank(admin);
        book.setAddress(Keys.FEE_MANAGER, address(feeManager));
        book.setAddress(Keys.TREASURY, address(treasury));
        book.setAddress(Keys.STABLECOIN_REGISTRY, address(stablecoins));
        book.setAddress(Keys.ORGANIZATION_REGISTRY, address(orgs));
        stablecoins.addToken(address(usdc), 6);
        feeManager.setFeeBps(FEE_ACTION, 250); // 2.5%
        vm.stopPrank();

        // Onboard the provider into an org.
        vm.prank(provider);
        orgs.registerOrg(ORG, "Provider Co", IOrganizationRegistry.OrgType.Supplier, "ipfs://x");

        usdc.mint(buyer, 10_000e6);
        vm.prank(buyer);
        usdc.approve(address(market), type(uint256).max);
    }

    function _list(uint32 accessDays) internal {
        vm.prank(provider);
        market.list(L1, address(usdc), PRICE, accessDays, CONTENT, "ipfs://dataset");
    }

    function test_List_HappyPath() public {
        vm.expectEmit(true, true, false, true, address(market));
        emit Listed(L1, provider, address(usdc), PRICE, 30);
        _list(30);

        IDataMarketplace.Listing memory l = market.listingOf(L1);
        assertEq(l.provider, provider);
        assertEq(l.price, PRICE);
        assertEq(uint8(l.state), uint8(IDataMarketplace.ListingState.Active));
    }

    function test_RevertWhen_ListZeroPrice() public {
        vm.prank(provider);
        vm.expectRevert(IDataMarketplace.ZeroPrice.selector);
        market.list(L1, address(usdc), 0, 30, CONTENT, "u");
    }

    function test_RevertWhen_ListDuplicate() public {
        _list(30);
        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(IDataMarketplace.ListingExists.selector, L1));
        market.list(L1, address(usdc), PRICE, 30, CONTENT, "u");
    }

    function test_RevertWhen_ListUnacceptedToken() public {
        MockUSDC other = new MockUSDC();
        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(DataMarketplace.TokenNotAccepted.selector, address(other)));
        market.list(L1, address(other), PRICE, 30, CONTENT, "u");
    }

    function test_RevertWhen_ListByNonOnboardedProvider() public {
        vm.prank(buyer); // buyer belongs to no org
        vm.expectRevert(abi.encodeWithSelector(DataMarketplace.ProviderNotOnboarded.selector, buyer));
        market.list(L1, address(usdc), PRICE, 30, CONTENT, "u");
    }

    function test_Purchase_SettlesNetOfFee_AndGrantsAccess() public {
        _list(30);

        uint256 providerBefore = usdc.balanceOf(provider);
        vm.prank(buyer);
        uint64 expiresAt = market.purchase(L1);

        uint256 fee = (PRICE * 250) / 10_000; // 25e6
        assertEq(usdc.balanceOf(provider), providerBefore + (PRICE - fee));
        assertEq(treasury.balanceOf(address(usdc)), fee);
        assertEq(usdc.balanceOf(address(market)), 0); // no dust retained

        assertTrue(market.hasAccess(L1, buyer));
        assertEq(expiresAt, uint64(block.timestamp) + 30 days);
    }

    function test_Purchase_EmitsEvent() public {
        _list(30);
        vm.expectEmit(true, true, false, true, address(market));
        emit AccessPurchased(L1, buyer, PRICE, uint64(block.timestamp) + 30 days);
        vm.prank(buyer);
        market.purchase(L1);
    }

    function test_Purchase_Perpetual_WhenZeroDays() public {
        _list(0);
        vm.prank(buyer);
        uint64 expiresAt = market.purchase(L1);
        assertEq(expiresAt, type(uint64).max);
        assertTrue(market.hasAccess(L1, buyer));
    }

    function test_Purchase_ExtendsAccess() public {
        _list(30);
        vm.startPrank(buyer);
        uint64 first = market.purchase(L1);
        uint64 second = market.purchase(L1);
        vm.stopPrank();
        assertEq(second, first + 30 days); // stacked from prior unexpired expiry
    }

    function test_AccessExpires() public {
        _list(1);
        vm.prank(buyer);
        market.purchase(L1);
        assertTrue(market.hasAccess(L1, buyer));
        vm.warp(block.timestamp + 2 days);
        assertFalse(market.hasAccess(L1, buyer));
    }

    function test_RevertWhen_SelfPurchase() public {
        _list(30);
        usdc.mint(provider, PRICE);
        vm.startPrank(provider);
        usdc.approve(address(market), PRICE);
        vm.expectRevert(abi.encodeWithSelector(IDataMarketplace.SelfPurchase.selector, L1));
        market.purchase(L1);
        vm.stopPrank();
    }

    function test_RevertWhen_PurchasePausedListing() public {
        _list(30);
        vm.prank(provider);
        market.setState(L1, IDataMarketplace.ListingState.Paused);
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                IDataMarketplace.InvalidState.selector,
                L1,
                IDataMarketplace.ListingState.Active,
                IDataMarketplace.ListingState.Paused
            )
        );
        market.purchase(L1);
    }

    function test_RevertWhen_PurchaseUnknownListing() public {
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(IDataMarketplace.UnknownListing.selector, L1));
        market.purchase(L1);
    }

    function test_UpdatePrice_ByProvider() public {
        _list(30);
        vm.prank(provider);
        market.updatePrice(L1, 2_000e6);
        assertEq(market.listingOf(L1).price, 2_000e6);
    }

    function test_RevertWhen_UpdatePriceByStranger() public {
        _list(30);
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(IDataMarketplace.NotProvider.selector, L1));
        market.updatePrice(L1, 1);
    }

    function test_SetState_DelistIsTerminal() public {
        _list(30);
        vm.startPrank(provider);
        market.setState(L1, IDataMarketplace.ListingState.Delisted);
        vm.expectRevert(
            abi.encodeWithSelector(
                IDataMarketplace.InvalidState.selector,
                L1,
                IDataMarketplace.ListingState.Active,
                IDataMarketplace.ListingState.Delisted
            )
        );
        market.setState(L1, IDataMarketplace.ListingState.Active);
        vm.stopPrank();
    }

    function test_Reentrancy_PurchaseIsGuarded() public {
        // A malicious payout token that re-enters purchase on transfer must be blocked by nonReentrant.
        ReentrantMarketToken evil = new ReentrantMarketToken();
        vm.prank(admin);
        stablecoins.addToken(address(evil), 6);

        vm.prank(provider);
        market.list(L1, address(evil), PRICE, 30, CONTENT, "u");

        evil.mint(buyer, 10_000e6);
        vm.prank(buyer);
        evil.approve(address(market), type(uint256).max);
        evil.arm(market, L1);

        vm.prank(buyer);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        market.purchase(L1);
    }
}
