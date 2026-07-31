// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { InvoiceFinancing } from "../../src/finance/InvoiceFinancing.sol";
import { DiscountCalculator } from "../../src/finance/DiscountCalculator.sol";
import { IInvoiceFinancing } from "../../src/interfaces/IInvoiceFinancing.sol";
import { ISettlementEscrow } from "../../src/interfaces/ISettlementEscrow.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { MockSettlementEscrow } from "./mocks/MockSettlementEscrow.sol";
import { MockAttestation } from "./mocks/MockAttestation.sol";
import { MockScoreOracle } from "./mocks/MockScoreOracle.sol";

contract InvoiceFinancingTest is Test {
    AddressBook internal book;
    InvoiceFinancing internal fin;
    MockSettlementEscrow internal escrow;
    MockAttestation internal att;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal supplier = address(0xB0B);
    address internal buyer = address(0xB111);
    address internal lender = address(0x1E4D);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");
    bytes32 internal constant NODEAL = keccak256("no-deal");
    uint256 internal constant AMOUNT = 1_000e6;
    uint256 internal constant ASK = 800e6;

    event Listed(bytes32 indexed batchId, address indexed supplier, address token, uint256 askAmount);
    event Funded(bytes32 indexed batchId, address indexed lender, uint256 amount);
    event Claimed(bytes32 indexed batchId, address indexed lender, uint256 principal, uint256 remainderToSupplier);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        fin = new InvoiceFinancing(address(book), admin);
        escrow = new MockSettlementEscrow();
        att = new MockAttestation();
        book.setAddress(Keys.SETTLEMENT_ESCROW, address(escrow));
        book.setAddress(Keys.ATTESTATION_REGISTRY, address(att));
        vm.stopPrank();

        usdc = new MockUSDC();

        // Seed a funded + attested deal, and pre-fund the escrow so it can release.
        escrow.setDeal(BATCH, buyer, supplier, address(usdc), AMOUNT, ISettlementEscrow.DealState.Funded);
        att.setAttested(BATCH, true, 9600);
        usdc.mint(address(escrow), AMOUNT);

        // Fund the lender.
        usdc.mint(lender, ASK);
        vm.prank(lender);
        usdc.approve(address(fin), type(uint256).max);
    }

    function _list() internal {
        vm.prank(supplier);
        fin.list(BATCH, ASK);
    }

    function _assignAndFund() internal {
        _list();
        vm.prank(supplier);
        escrow.setPayee(BATCH, address(fin));
        vm.prank(lender);
        fin.fund(BATCH);
    }

    // --------------------------------------------------------------- list

    function test_List_Happy() public {
        vm.expectEmit(true, true, false, true);
        emit Listed(BATCH, supplier, address(usdc), ASK);
        _list();

        IInvoiceFinancing.Listing memory l = fin.listingOf(BATCH);
        assertEq(uint8(l.state), uint8(IInvoiceFinancing.ListingState.Listed));
        assertEq(l.supplier, supplier);
        assertEq(l.token, address(usdc));
        assertEq(l.askAmount, ASK);
        assertEq(l.lender, address(0));
    }

    function test_Revert_List_ZeroAmount() public {
        vm.prank(supplier);
        vm.expectRevert(IInvoiceFinancing.ZeroAmount.selector);
        fin.list(BATCH, 0);
    }

    function test_Revert_List_NotFunded() public {
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(IInvoiceFinancing.NotFunded.selector, NODEAL));
        fin.list(NODEAL, ASK);
    }

    function test_Revert_List_NotSupplier() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IInvoiceFinancing.NotSupplier.selector, BATCH));
        fin.list(BATCH, ASK);
    }

    function test_Revert_List_NotAttested() public {
        att.setAttested(BATCH, false, 0);
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(IInvoiceFinancing.NotAttested.selector, BATCH));
        fin.list(BATCH, ASK);
    }

    function test_Revert_List_AskExceedsFace() public {
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(InvoiceFinancing.AskExceedsFace.selector, BATCH));
        fin.list(BATCH, AMOUNT + 1);
    }

    function test_Revert_List_ListingExists() public {
        _list();
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(IInvoiceFinancing.ListingExists.selector, BATCH));
        fin.list(BATCH, ASK);
    }

    // --------------------------------------------------------------- fund

    function test_Fund_Happy() public {
        _list();
        vm.prank(supplier);
        escrow.setPayee(BATCH, address(fin));

        uint256 supBefore = usdc.balanceOf(supplier);
        vm.expectEmit(true, true, false, true);
        emit Funded(BATCH, lender, ASK);
        vm.prank(lender);
        fin.fund(BATCH);

        // Advance flowed straight to the supplier; lender is recorded.
        assertEq(usdc.balanceOf(supplier), supBefore + ASK);
        assertEq(usdc.balanceOf(lender), 0);
        IInvoiceFinancing.Listing memory l = fin.listingOf(BATCH);
        assertEq(uint8(l.state), uint8(IInvoiceFinancing.ListingState.Funded));
        assertEq(l.lender, lender);
    }

    function test_Revert_Fund_UnknownListing() public {
        vm.prank(lender);
        vm.expectRevert(abi.encodeWithSelector(IInvoiceFinancing.UnknownListing.selector, NODEAL));
        fin.fund(NODEAL);
    }

    function test_Revert_Fund_PayeeNotAssigned() public {
        _list();
        vm.prank(lender);
        vm.expectRevert(abi.encodeWithSelector(InvoiceFinancing.PayeeNotAssigned.selector, BATCH));
        fin.fund(BATCH);
    }

    function test_Revert_Fund_AlreadyFunded() public {
        _assignAndFund();
        vm.prank(lender);
        vm.expectRevert(abi.encodeWithSelector(IInvoiceFinancing.AlreadyFunded.selector, BATCH));
        fin.fund(BATCH);
    }

    function test_Revert_Fund_DealNoLongerFunded() public {
        _list();
        vm.prank(supplier);
        escrow.setPayee(BATCH, address(fin));
        escrow.setState(BATCH, ISettlementEscrow.DealState.Released);
        vm.prank(lender);
        vm.expectRevert(abi.encodeWithSelector(IInvoiceFinancing.NotFunded.selector, BATCH));
        fin.fund(BATCH);
    }

    // --------------------------------------------------------------- claim

    function test_Claim_PrincipalOnlyFallback() public {
        _assignAndFund();
        escrow.release(BATCH); // pays AMOUNT to the financing contract (the payee)

        uint256 supBefore = usdc.balanceOf(supplier);
        vm.expectEmit(true, true, false, true);
        emit Claimed(BATCH, lender, ASK, AMOUNT - ASK);
        fin.claim(BATCH);

        // No pricing oracle -> lender recovers principal only, supplier keeps the surplus.
        assertEq(usdc.balanceOf(lender), ASK);
        assertEq(usdc.balanceOf(supplier), supBefore + (AMOUNT - ASK));
        // All proceeds distributed; nothing stranded in the contract.
        assertEq(usdc.balanceOf(address(fin)), 0);
        assertEq(uint8(fin.listingOf(BATCH).state), uint8(IInvoiceFinancing.ListingState.Claimed));
    }

    function test_Claim_WithDiscountYield() public {
        // Wire a score oracle + discount calculator so the lender earns a risk/tenor spread.
        MockScoreOracle oracle = new MockScoreOracle();
        vm.startPrank(admin);
        DiscountCalculator calc = new DiscountCalculator(address(book), admin);
        book.setAddress(Keys.SCORE_ORACLE, address(oracle));
        book.setAddress(Keys.DISCOUNT_CALCULATOR, address(calc));
        vm.stopPrank();
        oracle.setGrade(supplier, 4); // discount = 4*50 = 200 bps (tenor 0)

        _assignAndFund();
        escrow.release(BATCH);

        uint256 expTake = (ASK * 10_000) / (10_000 - 200);
        uint256 expRemainder = AMOUNT - expTake;

        (uint256 qTake, uint256 qRem) = fin.quoteClaim(BATCH);
        assertEq(qTake, expTake);
        assertEq(qRem, expRemainder);

        uint256 supBefore = usdc.balanceOf(supplier);
        fin.claim(BATCH);

        assertEq(usdc.balanceOf(lender), expTake);
        assertEq(usdc.balanceOf(supplier), supBefore + expRemainder);
        assertGt(expTake, ASK); // lender profited
        assertEq(usdc.balanceOf(address(fin)), 0);
    }

    function test_Revert_Claim_UnknownListing() public {
        vm.expectRevert(abi.encodeWithSelector(IInvoiceFinancing.UnknownListing.selector, NODEAL));
        fin.claim(NODEAL);
    }

    function test_Revert_Claim_NotFunded() public {
        _list();
        vm.expectRevert(abi.encodeWithSelector(IInvoiceFinancing.NotFunded.selector, BATCH));
        fin.claim(BATCH);
    }

    function test_Revert_Claim_NotReleased() public {
        _assignAndFund();
        vm.expectRevert(abi.encodeWithSelector(InvoiceFinancing.NotReleased.selector, BATCH));
        fin.claim(BATCH);
    }

    function test_Revert_Claim_AlreadyClaimed() public {
        _assignAndFund();
        escrow.release(BATCH);
        fin.claim(BATCH);
        vm.expectRevert(abi.encodeWithSelector(InvoiceFinancing.AlreadyClaimed.selector, BATCH));
        fin.claim(BATCH);
    }

    // --------------------------------------------------------------- cancel

    function test_Cancel_Happy() public {
        _list();
        vm.prank(supplier);
        fin.cancel(BATCH);
        assertEq(uint8(fin.listingOf(BATCH).state), uint8(IInvoiceFinancing.ListingState.Cancelled));
    }

    function test_Revert_Cancel_NotSupplier() public {
        _list();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IInvoiceFinancing.NotSupplier.selector, BATCH));
        fin.cancel(BATCH);
    }

    function test_Revert_Cancel_AlreadyFunded() public {
        _assignAndFund();
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(IInvoiceFinancing.AlreadyFunded.selector, BATCH));
        fin.cancel(BATCH);
    }

    function test_Revert_Cancel_UnknownListing() public {
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(IInvoiceFinancing.UnknownListing.selector, NODEAL));
        fin.cancel(NODEAL);
    }
}
