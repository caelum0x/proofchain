// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { RepaymentController } from "../../src/finance/RepaymentController.sol";
import { FinancingPool } from "../../src/finance/FinancingPool.sol";
import { LenderVault } from "../../src/finance/LenderVault.sol";
import { InvoiceFinancing } from "../../src/finance/InvoiceFinancing.sol";
import { DiscountCalculator } from "../../src/finance/DiscountCalculator.sol";
import { IRepaymentController } from "../../src/interfaces/IRepaymentController.sol";
import { IInvoiceFinancing } from "../../src/interfaces/IInvoiceFinancing.sol";
import { ISettlementEscrow } from "../../src/interfaces/ISettlementEscrow.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { MockSettlementEscrow } from "./mocks/MockSettlementEscrow.sol";
import { MockAttestation } from "./mocks/MockAttestation.sol";
import { MockScoreOracle } from "./mocks/MockScoreOracle.sol";

contract RepaymentControllerTest is Test {
    AddressBook internal book;
    RepaymentController internal rc;
    FinancingPool internal pool;
    LenderVault internal vault;
    InvoiceFinancing internal fin;
    DiscountCalculator internal calc;
    MockSettlementEscrow internal escrow;
    MockAttestation internal att;
    MockScoreOracle internal oracle;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal lp = address(0x1D);
    address internal supplier = address(0xB0B);
    address internal buyer = address(0xB111);

    bytes32 internal constant BATCH = keccak256("batch-1");
    uint256 internal constant DEPOSIT = 1_000e6;
    uint256 internal constant AMOUNT = 1_000e6;
    uint256 internal constant ASK = 800e6;

    event Repaid(bytes32 indexed batchId, address indexed lender, uint256 principalPlusFee, uint256 remainder);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        usdc = new MockUSDC();
        vault = new LenderVault(address(book), admin, address(usdc));
        fin = new InvoiceFinancing(address(book), admin);
        pool = new FinancingPool(address(book), admin, 5);
        calc = new DiscountCalculator(address(book), admin);
        rc = new RepaymentController(address(book), admin);
        escrow = new MockSettlementEscrow();
        att = new MockAttestation();
        oracle = new MockScoreOracle();

        book.setAddress(Keys.LENDER_VAULT, address(vault));
        book.setAddress(Keys.INVOICE_FINANCING, address(fin));
        book.setAddress(Keys.FINANCING_POOL, address(pool));
        book.setAddress(Keys.DISCOUNT_CALCULATOR, address(calc));
        book.setAddress(Keys.SCORE_ORACLE, address(oracle));
        book.setAddress(Keys.SETTLEMENT_ESCROW, address(escrow));
        book.setAddress(Keys.ATTESTATION_REGISTRY, address(att));
        book.setAddress(Keys.REPAYMENT_CONTROLLER, address(rc));
        vm.stopPrank();

        escrow.setDeal(BATCH, buyer, supplier, address(usdc), AMOUNT, ISettlementEscrow.DealState.Funded);
        att.setAttested(BATCH, true, 9600);
        usdc.mint(address(escrow), AMOUNT);
        oracle.setGrade(supplier, 4);

        usdc.mint(lp, DEPOSIT);
        vm.startPrank(lp);
        usdc.approve(address(pool), type(uint256).max);
        pool.deposit(DEPOSIT);
        vm.stopPrank();

        // List + assign payout + pool funds the receivable.
        vm.prank(supplier);
        fin.list(BATCH, ASK);
        vm.prank(supplier);
        escrow.setPayee(BATCH, address(fin));
        vm.prank(admin);
        pool.allocate(BATCH);
    }

    function test_OnSettle_ClaimsAndReconciles() public {
        escrow.release(BATCH);

        uint256 expTake = (ASK * 10_000) / (10_000 - 200);
        uint256 expRemainder = AMOUNT - expTake;

        vm.expectEmit(true, true, false, true);
        emit Repaid(BATCH, address(pool), expTake, expRemainder);
        rc.onSettle(BATCH);

        // Claimed + reconciled: pool holds nothing, deployed cleared, yield in the vault.
        assertEq(uint8(fin.listingOf(BATCH).state), uint8(IInvoiceFinancing.ListingState.Claimed));
        assertEq(pool.deployedAssets(), 0);
        assertEq(usdc.balanceOf(address(pool)), 0);
        assertEq(vault.totalAssets(), DEPOSIT + (expTake - ASK));
        assertEq(usdc.balanceOf(supplier), ASK + expRemainder);
    }

    function test_Revert_OnSettle_NotSettled() public {
        // Deal still Funded (not released).
        vm.expectRevert(abi.encodeWithSelector(IRepaymentController.NotSettled.selector, BATCH));
        rc.onSettle(BATCH);
    }

    function test_Revert_OnSettle_NoFinancing() public {
        bytes32 b2 = keccak256("batch-2");
        escrow.setDeal(b2, buyer, supplier, address(usdc), AMOUNT, ISettlementEscrow.DealState.Released);
        vm.expectRevert(abi.encodeWithSelector(IRepaymentController.NoFinancing.selector, b2));
        rc.onSettle(b2);
    }

    function test_Revert_OnSettle_AlreadyProcessed() public {
        escrow.release(BATCH);
        rc.onSettle(BATCH);
        vm.expectRevert(abi.encodeWithSelector(RepaymentController.AlreadyProcessed.selector, BATCH));
        rc.onSettle(BATCH);
    }
}
