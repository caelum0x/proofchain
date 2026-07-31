// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { FinancingMarketplace } from "../../src/marketplace/FinancingMarketplace.sol";
import { IFinancingMarketplace } from "../../src/interfaces/IFinancingMarketplace.sol";
import { IInvoiceFinancing } from "../../src/interfaces/IInvoiceFinancing.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { MockInvoiceFinancing } from "./mocks/MockInvoiceFinancing.sol";
import { ReenterERC20 } from "./mocks/ReenterERC20.sol";

contract FinancingMarketplaceTest is Test {
    AddressBook internal book;
    FinancingMarketplace internal market;
    MockInvoiceFinancing internal financing;
    MockUSDC internal token;

    address internal admin = address(0xA11CE);
    address internal supplier = address(0x5099);
    address internal lender = address(0x1E4DE7);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");
    uint256 internal constant ASK = 1_000e6;
    uint256 internal constant OFFER = 950e6;

    event OfferMade(uint256 indexed offerId, bytes32 indexed batchId, address indexed maker, uint256 amount);
    event OfferTaken(uint256 indexed offerId, address indexed taker);
    event OfferCancelled(uint256 indexed offerId);

    function setUp() public {
        book = new AddressBook(admin);
        market = new FinancingMarketplace(address(book), admin);
        financing = new MockInvoiceFinancing();

        vm.prank(admin);
        book.setAddress(Keys.INVOICE_FINANCING, address(financing));

        token = new MockUSDC();
        token.mint(lender, 10_000e6);
        vm.prank(lender);
        token.approve(address(market), type(uint256).max);

        // A receivable is listed for financing in the (mock) InvoiceFinancing.
        financing.setListing(BATCH, supplier, address(token), ASK, IInvoiceFinancing.ListingState.Listed);
    }

    function _make(uint256 amount) internal returns (uint256) {
        vm.prank(lender);
        return market.makeOffer(BATCH, address(token), amount);
    }

    // --- construction ---

    function test_Constructor_RevertsZeroAddress() public {
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        new FinancingMarketplace(address(0), admin);
    }

    // --- makeOffer ---

    function test_MakeOffer_HappyPath() public {
        vm.expectEmit(true, true, true, true);
        emit OfferMade(1, BATCH, lender, OFFER);
        uint256 id = _make(OFFER);

        assertEq(id, 1);
        assertEq(token.balanceOf(address(market)), OFFER); // capital escrowed
        assertEq(token.balanceOf(lender), 10_000e6 - OFFER);
        IFinancingMarketplace.Offer memory o = market.offerOf(id);
        assertEq(o.maker, lender);
        assertEq(o.amount, OFFER);
        assertFalse(o.taken);
        assertFalse(o.cancelled);
    }

    function test_MakeOffer_RevertsZeroAmount() public {
        vm.prank(lender);
        vm.expectRevert(IFinancingMarketplace.ZeroAmount.selector);
        market.makeOffer(BATCH, address(token), 0);
    }

    function test_MakeOffer_RevertsZeroToken() public {
        vm.prank(lender);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        market.makeOffer(BATCH, address(0), OFFER);
    }

    function test_MakeOffer_RevertsReceivableNotListed() public {
        bytes32 other = keccak256("no-listing");
        vm.prank(lender);
        vm.expectRevert(abi.encodeWithSelector(FinancingMarketplace.ReceivableNotListed.selector, other));
        market.makeOffer(other, address(token), OFFER);
    }

    function test_MakeOffer_RevertsTokenMismatch() public {
        MockUSDC other = new MockUSDC();
        other.mint(lender, 10_000e6);
        vm.startPrank(lender);
        other.approve(address(market), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(FinancingMarketplace.TokenMismatch.selector, BATCH, address(token), address(other))
        );
        market.makeOffer(BATCH, address(other), OFFER);
        vm.stopPrank();
    }

    function test_MakeOffer_RevertsWhenListingFunded() public {
        financing.setListing(BATCH, supplier, address(token), ASK, IInvoiceFinancing.ListingState.Funded);
        vm.prank(lender);
        vm.expectRevert(abi.encodeWithSelector(FinancingMarketplace.ReceivableNotListed.selector, BATCH));
        market.makeOffer(BATCH, address(token), OFFER);
    }

    // --- takeOffer ---

    function test_TakeOffer_HappyPath() public {
        uint256 id = _make(OFFER);
        vm.expectEmit(true, true, false, false);
        emit OfferTaken(id, supplier);
        vm.prank(supplier);
        market.takeOffer(id);

        assertEq(token.balanceOf(supplier), OFFER); // advance delivered
        assertEq(token.balanceOf(address(market)), 0);
        assertTrue(market.offerOf(id).taken);
    }

    function test_TakeOffer_RevertsNotSupplier() public {
        uint256 id = _make(OFFER);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(FinancingMarketplace.NotReceivableSupplier.selector, id));
        market.takeOffer(id);
    }

    function test_TakeOffer_RevertsUnknownOffer() public {
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(IFinancingMarketplace.UnknownOffer.selector, 99));
        market.takeOffer(99);
    }

    function test_TakeOffer_RevertsAlreadyTaken() public {
        uint256 id = _make(OFFER);
        vm.prank(supplier);
        market.takeOffer(id);
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(IFinancingMarketplace.OfferClosed.selector, id));
        market.takeOffer(id);
    }

    // --- cancelOffer ---

    function test_CancelOffer_RefundsMaker() public {
        uint256 id = _make(OFFER);
        vm.expectEmit(true, false, false, false);
        emit OfferCancelled(id);
        vm.prank(lender);
        market.cancelOffer(id);

        assertEq(token.balanceOf(lender), 10_000e6); // fully refunded
        assertEq(token.balanceOf(address(market)), 0);
        assertTrue(market.offerOf(id).cancelled);
    }

    function test_CancelOffer_RevertsNotMaker() public {
        uint256 id = _make(OFFER);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IFinancingMarketplace.NotMaker.selector, id));
        market.cancelOffer(id);
    }

    function test_CancelOffer_RevertsAfterTaken() public {
        uint256 id = _make(OFFER);
        vm.prank(supplier);
        market.takeOffer(id);
        vm.prank(lender);
        vm.expectRevert(abi.encodeWithSelector(IFinancingMarketplace.OfferClosed.selector, id));
        market.cancelOffer(id);
    }

    function test_TakeOffer_CannotAfterCancel() public {
        uint256 id = _make(OFFER);
        vm.prank(lender);
        market.cancelOffer(id);
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(IFinancingMarketplace.OfferClosed.selector, id));
        market.takeOffer(id);
    }

    // --- reentrancy (money-movement safety) ---

    function test_CancelOffer_ReentrancyBlocked() public {
        ReenterERC20 evil = new ReenterERC20();
        evil.mint(lender, 10_000e6);
        vm.prank(lender);
        evil.approve(address(market), type(uint256).max);
        financing.setListing(BATCH, supplier, address(evil), ASK, IInvoiceFinancing.ListingState.Listed);

        vm.prank(lender);
        uint256 id = market.makeOffer(BATCH, address(evil), OFFER);

        evil.arm(address(market), abi.encodeWithSelector(market.cancelOffer.selector, id));

        vm.prank(lender);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        market.cancelOffer(id);
    }
}
