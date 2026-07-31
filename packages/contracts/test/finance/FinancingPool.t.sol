// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { FinancingPool } from "../../src/finance/FinancingPool.sol";
import { LenderVault } from "../../src/finance/LenderVault.sol";
import { InvoiceFinancing } from "../../src/finance/InvoiceFinancing.sol";
import { DiscountCalculator } from "../../src/finance/DiscountCalculator.sol";
import { IFinancingPool } from "../../src/interfaces/IFinancingPool.sol";
import { IInvoiceFinancing } from "../../src/interfaces/IInvoiceFinancing.sol";
import { ISettlementEscrow } from "../../src/interfaces/ISettlementEscrow.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { MockSettlementEscrow } from "./mocks/MockSettlementEscrow.sol";
import { MockAttestation } from "./mocks/MockAttestation.sol";
import { MockScoreOracle } from "./mocks/MockScoreOracle.sol";

contract FinancingPoolTest is Test {
    AddressBook internal book;
    FinancingPool internal pool;
    LenderVault internal vault;
    InvoiceFinancing internal fin;
    DiscountCalculator internal calc;
    MockSettlementEscrow internal escrow;
    MockAttestation internal att;
    MockScoreOracle internal oracle;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal lp = address(0x1D); // liquidity provider
    address internal supplier = address(0xB0B);
    address internal buyer = address(0xB111);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");
    uint256 internal constant DEPOSIT = 1_000e6;
    uint256 internal constant AMOUNT = 1_000e6;
    uint256 internal constant ASK = 800e6;
    uint8 internal constant MAX_GRADE = 5;

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        usdc = new MockUSDC();
        vault = new LenderVault(address(book), admin, address(usdc));
        fin = new InvoiceFinancing(address(book), admin);
        pool = new FinancingPool(address(book), admin, MAX_GRADE);
        calc = new DiscountCalculator(address(book), admin);
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
        vm.stopPrank();

        // Seed the receivable, pre-fund the escrow, grade the supplier eligible.
        escrow.setDeal(BATCH, buyer, supplier, address(usdc), AMOUNT, ISettlementEscrow.DealState.Funded);
        att.setAttested(BATCH, true, 9600);
        usdc.mint(address(escrow), AMOUNT);
        oracle.setGrade(supplier, 4); // <= MAX_GRADE, discount 200 bps

        // Provide pool liquidity.
        usdc.mint(lp, DEPOSIT);
        vm.startPrank(lp);
        usdc.approve(address(pool), type(uint256).max);
        pool.deposit(DEPOSIT);
        vm.stopPrank();
    }

    function _list() internal {
        vm.prank(supplier);
        fin.list(BATCH, ASK);
        vm.prank(supplier);
        escrow.setPayee(BATCH, address(fin));
    }

    // ------------------------------------------------------------- liquidity

    function test_Deposit_MintsVaultShares() public view {
        assertEq(vault.balanceOf(lp), DEPOSIT);
        assertEq(pool.totalLiquidity(), DEPOSIT);
        assertEq(vault.totalAssets(), DEPOSIT);
    }

    function test_Withdraw_ReturnsAssets() public {
        uint256 shares = vault.balanceOf(lp);
        vm.prank(lp);
        vault.approve(address(pool), shares);
        vm.prank(lp);
        uint256 assets = pool.withdraw(shares);
        assertEq(assets, DEPOSIT);
        assertEq(usdc.balanceOf(lp), DEPOSIT);
    }

    function test_Revert_Deposit_ZeroAmount() public {
        vm.prank(lp);
        vm.expectRevert(IFinancingPool.ZeroAmount.selector);
        pool.deposit(0);
    }

    // ------------------------------------------------------------- allocate

    function test_Allocate_Happy() public {
        _list();
        uint256 supBefore = usdc.balanceOf(supplier);

        vm.prank(admin); // admin holds POOL_MANAGER_ROLE
        pool.allocate(BATCH);

        assertEq(usdc.balanceOf(supplier), supBefore + ASK); // advance paid
        assertEq(pool.deployedAssets(), ASK);
        assertEq(pool.allocatedPrincipal(BATCH), ASK);
        assertEq(usdc.balanceOf(address(vault)), DEPOSIT - ASK); // idle drawn down
        assertEq(vault.totalAssets(), DEPOSIT); // NAV preserved (idle + deployed)

        IInvoiceFinancing.Listing memory l = fin.listingOf(BATCH);
        assertEq(l.lender, address(pool));
        assertEq(uint8(l.state), uint8(IInvoiceFinancing.ListingState.Funded));
    }

    function test_Revert_Allocate_NotPoolManager() public {
        _list();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.POOL_MANAGER_ROLE
            )
        );
        pool.allocate(BATCH);
    }

    function test_Revert_Allocate_NotListed() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(FinancingPool.NotListed.selector, BATCH));
        pool.allocate(BATCH);
    }

    function test_Revert_Allocate_IneligibleGrade_Ungraded() public {
        oracle.setGrade(supplier, 0);
        _list();
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IFinancingPool.IneligibleGrade.selector, BATCH, uint8(0)));
        pool.allocate(BATCH);
    }

    function test_Revert_Allocate_IneligibleGrade_TooRisky() public {
        oracle.setGrade(supplier, 6); // > MAX_GRADE
        _list();
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IFinancingPool.IneligibleGrade.selector, BATCH, uint8(6)));
        pool.allocate(BATCH);
    }

    function test_Revert_Allocate_InsufficientLiquidity() public {
        // Drain most liquidity by lowering nothing; instead list an ask above available.
        // Withdraw almost all LP liquidity first.
        uint256 shares = vault.balanceOf(lp);
        vm.prank(lp);
        vault.approve(address(pool), shares);
        vm.prank(lp);
        pool.withdraw((shares * 9) / 10); // leaves 100e6 idle

        _list(); // ASK = 800e6 > 100e6 available
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IFinancingPool.InsufficientLiquidity.selector, ASK, 100e6));
        pool.allocate(BATCH);
    }

    function test_Revert_Allocate_AssetMismatch() public {
        MockUSDC other = new MockUSDC();
        bytes32 b2 = keccak256("batch-2");
        escrow.setDeal(b2, buyer, supplier, address(other), AMOUNT, ISettlementEscrow.DealState.Funded);
        att.setAttested(b2, true, 9600);
        vm.prank(supplier);
        fin.list(b2, ASK);
        vm.prank(supplier);
        escrow.setPayee(b2, address(fin));

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(FinancingPool.AssetMismatch.selector, b2));
        pool.allocate(b2);
    }

    function test_Revert_Allocate_AlreadyAllocated() public {
        _list();
        vm.prank(admin);
        pool.allocate(BATCH);
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(FinancingPool.AlreadyAllocated.selector, BATCH));
        pool.allocate(BATCH);
    }

    // ------------------------------------------------------------- reconcile / full cycle

    function test_FullCycle_YieldAccruesToDepositors() public {
        _list();
        vm.prank(admin);
        pool.allocate(BATCH);

        escrow.release(BATCH); // AMOUNT paid to financing (the payee)
        fin.claim(BATCH); // pool (lender) receives principal + yield

        uint256 expTake = (ASK * 10_000) / (10_000 - 200);
        assertEq(usdc.balanceOf(address(pool)), expTake); // proceeds parked in pool pre-reconcile

        vm.prank(admin);
        pool.reconcile(BATCH);

        assertEq(pool.deployedAssets(), 0);
        assertEq(pool.allocatedPrincipal(BATCH), 0);
        assertEq(usdc.balanceOf(address(pool)), 0);

        uint256 yield = expTake - ASK;
        assertEq(vault.totalAssets(), DEPOSIT + yield);

        // LP redeems and captures the yield.
        uint256 shares = vault.balanceOf(lp);
        vm.prank(lp);
        vault.approve(address(pool), shares);
        vm.prank(lp);
        uint256 assets = pool.withdraw(shares);
        // ERC4626 virtual shares can round the final redemption down by <=1 wei.
        assertApproxEqAbs(assets, DEPOSIT + yield, 2);
    }

    function test_Revert_Reconcile_Unauthorized() public {
        _list();
        vm.prank(admin);
        pool.allocate(BATCH);
        escrow.release(BATCH);
        fin.claim(BATCH);

        vm.prank(stranger);
        vm.expectRevert(FinancingPool.Unauthorized.selector);
        pool.reconcile(BATCH);
    }

    function test_Revert_Reconcile_NothingAllocated() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(FinancingPool.NothingAllocated.selector, BATCH));
        pool.reconcile(BATCH);
    }

    function test_Revert_Reconcile_NotClaimed() public {
        _list();
        vm.prank(admin);
        pool.allocate(BATCH);
        // Not released/claimed yet.
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(FinancingPool.NotClaimed.selector, BATCH));
        pool.reconcile(BATCH);
    }

    // ------------------------------------------------------------- admin

    function test_SetMaxGrade() public {
        vm.prank(admin);
        pool.setMaxGrade(3);
        assertEq(pool.maxGrade(), 3);
    }

    function test_Revert_SetMaxGrade_NotManager() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.POOL_MANAGER_ROLE
            )
        );
        pool.setMaxGrade(3);
    }
}
