// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { ListingRegistry } from "../../src/marketplace/ListingRegistry.sol";
import { IListingRegistry } from "../../src/interfaces/IListingRegistry.sol";

contract ListingRegistryTest is Test {
    AddressBook internal book;
    ListingRegistry internal registry;

    address internal admin = address(0xA11CE);
    address internal market = address(0x1A4E7);
    address internal seller = address(0x5E11E);
    address internal buyer = address(0xB0B);
    address internal stranger = address(0xDEAD);

    address internal asset = address(0xA55E7);
    address internal token = address(0x70CE7);

    event ListingCreated(
        uint256 indexed listingId, address indexed seller, IListingRegistry.AssetKind kind, address asset, uint256 assetId, uint256 price
    );
    event ListingCancelled(uint256 indexed listingId);
    event ListingFilled(uint256 indexed listingId, address indexed buyer);

    function setUp() public {
        book = new AddressBook(admin);
        registry = new ListingRegistry(address(book), admin);
        bytes32 _marketRole = registry.MARKET_ROLE();
        vm.prank(admin);
        registry.grantRole(_marketRole, market);
    }

    function _create() internal returns (uint256) {
        vm.prank(seller);
        return registry.createListing(IListingRegistry.AssetKind.ERC1155, asset, 7, 100, token, 5e6);
    }

    // --- construction ---

    function test_Constructor_RevertsZeroAddress() public {
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        new ListingRegistry(address(0), admin);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        new ListingRegistry(address(book), address(0));
    }

    // --- createListing ---

    function test_CreateListing_HappyPath() public {
        vm.expectEmit(true, true, false, true);
        emit ListingCreated(1, seller, IListingRegistry.AssetKind.ERC1155, asset, 7, 5e6);
        uint256 id = _create();

        assertEq(id, 1);
        assertEq(registry.totalListings(), 1);
        IListingRegistry.Listing memory l = registry.listingOf(id);
        assertEq(uint256(l.kind), uint256(IListingRegistry.AssetKind.ERC1155));
        assertEq(l.asset, asset);
        assertEq(l.assetId, 7);
        assertEq(l.amount, 100);
        assertEq(l.seller, seller);
        assertEq(l.paymentToken, token);
        assertEq(l.price, 5e6);
        assertEq(uint256(l.status), uint256(IListingRegistry.ListingStatus.Active));
    }

    function test_CreateListing_ERC721NormalizesAmountToOne() public {
        vm.prank(seller);
        uint256 id = registry.createListing(IListingRegistry.AssetKind.ERC721, asset, 42, 0, token, 1e6);
        assertEq(registry.listingOf(id).amount, 1);
    }

    function test_CreateListing_IncrementsIds() public {
        assertEq(_create(), 1);
        assertEq(_create(), 2);
    }

    function test_CreateListing_RevertsUnknownKind() public {
        vm.prank(seller);
        vm.expectRevert(ListingRegistry.InvalidKind.selector);
        registry.createListing(IListingRegistry.AssetKind.Unknown, asset, 0, 1, token, 1e6);
    }

    function test_CreateListing_RevertsZeroAsset() public {
        vm.prank(seller);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        registry.createListing(IListingRegistry.AssetKind.ERC1155, address(0), 0, 1, token, 1e6);
    }

    function test_CreateListing_RevertsZeroToken() public {
        vm.prank(seller);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        registry.createListing(IListingRegistry.AssetKind.ERC1155, asset, 0, 1, address(0), 1e6);
    }

    function test_CreateListing_RevertsZeroPrice() public {
        vm.prank(seller);
        vm.expectRevert(IListingRegistry.ZeroPrice.selector);
        registry.createListing(IListingRegistry.AssetKind.ERC1155, asset, 0, 1, token, 0);
    }

    function test_CreateListing_RevertsZeroAmountForFungible() public {
        vm.prank(seller);
        vm.expectRevert(ListingRegistry.ZeroAmount.selector);
        registry.createListing(IListingRegistry.AssetKind.ERC1155, asset, 0, 0, token, 1e6);
    }

    // --- cancelListing ---

    function test_CancelListing_HappyPath() public {
        uint256 id = _create();
        vm.expectEmit(true, false, false, false);
        emit ListingCancelled(id);
        vm.prank(seller);
        registry.cancelListing(id);
        assertEq(uint256(registry.listingOf(id).status), uint256(IListingRegistry.ListingStatus.Cancelled));
    }

    function test_CancelListing_RevertsUnknown() public {
        vm.prank(seller);
        vm.expectRevert(abi.encodeWithSelector(IListingRegistry.UnknownListing.selector, 99));
        registry.cancelListing(99);
    }

    function test_CancelListing_RevertsNotSeller() public {
        uint256 id = _create();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IListingRegistry.NotSeller.selector, id));
        registry.cancelListing(id);
    }

    function test_CancelListing_RevertsNotActiveWhenAlreadyCancelled() public {
        uint256 id = _create();
        vm.startPrank(seller);
        registry.cancelListing(id);
        vm.expectRevert(abi.encodeWithSelector(IListingRegistry.NotActive.selector, id));
        registry.cancelListing(id);
        vm.stopPrank();
    }

    // --- markFilled (access control) ---

    function test_MarkFilled_HappyPath() public {
        uint256 id = _create();
        vm.expectEmit(true, true, false, false);
        emit ListingFilled(id, buyer);
        vm.prank(market);
        registry.markFilled(id, buyer);
        assertEq(uint256(registry.listingOf(id).status), uint256(IListingRegistry.ListingStatus.Filled));
    }

    function test_MarkFilled_RevertsUnauthorized() public {
        uint256 id = _create();
        bytes32 _role = registry.MARKET_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, _role
            )
        );
        registry.markFilled(id, buyer);
    }

    function test_MarkFilled_RevertsZeroBuyer() public {
        uint256 id = _create();
        vm.prank(market);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        registry.markFilled(id, address(0));
    }

    function test_MarkFilled_RevertsNotActive() public {
        uint256 id = _create();
        vm.prank(seller);
        registry.cancelListing(id);
        vm.prank(market);
        vm.expectRevert(abi.encodeWithSelector(IListingRegistry.NotActive.selector, id));
        registry.markFilled(id, buyer);
    }

    // --- views ---

    function test_ListingOf_RevertsUnknown() public {
        vm.expectRevert(abi.encodeWithSelector(IListingRegistry.UnknownListing.selector, 1));
        registry.listingOf(1);
    }
}
