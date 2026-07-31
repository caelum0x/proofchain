// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { SupplyChainFinance } from "../../src/tradefinance/SupplyChainFinance.sol";
import { ISupplyChainFinance } from "../../src/interfaces/ISupplyChainFinance.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { MockAttestation } from "./mocks/MockAttestation.sol";

contract SupplyChainFinanceTest is Test {
    AddressBook internal book;
    SupplyChainFinance internal scf;
    MockAttestation internal att;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal anchorBuyer = address(0xB111);
    address internal funder = address(0xF1);
    address internal supplier = address(0x5099);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant PROGRAM = keccak256("prog-1");
    bytes32 internal constant INV = keccak256("inv-1");
    bytes32 internal constant BATCH = keccak256("batch-1");
    uint16 internal constant DISC_BPS = 300; // 3%
    uint256 internal constant LIMIT = 10_000e6;
    uint256 internal constant AMOUNT = 1_000e6;
    uint64 internal dueDate;

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        scf = new SupplyChainFinance(address(book), admin);
        att = new MockAttestation();
        book.setAddress(Keys.ATTESTATION_REGISTRY, address(att));
        vm.stopPrank();

        usdc = new MockUSDC();
        att.setAttested(BATCH, true, 9600);
        dueDate = uint64(block.timestamp + 30 days);

        usdc.mint(funder, LIMIT * 2);
        usdc.mint(anchorBuyer, LIMIT * 2);
        vm.prank(funder);
        usdc.approve(address(scf), type(uint256).max);
        vm.prank(anchorBuyer);
        usdc.approve(address(scf), type(uint256).max);
    }

    function _createProgram() internal {
        vm.prank(anchorBuyer);
        scf.createProgram(PROGRAM, funder, address(usdc), DISC_BPS, LIMIT);
    }

    function _approve() internal {
        vm.prank(anchorBuyer);
        scf.approveInvoice(INV, PROGRAM, BATCH, supplier, AMOUNT, dueDate);
    }

    function test_CreateProgram_Happy() public {
        _createProgram();
        ISupplyChainFinance.Program memory p = scf.programOf(PROGRAM);
        assertEq(p.anchorBuyer, anchorBuyer);
        assertEq(p.funder, funder);
        assertEq(p.fundingLimit, LIMIT);
        assertTrue(p.active);
    }

    function test_Revert_CreateProgram_Exists() public {
        _createProgram();
        vm.prank(anchorBuyer);
        vm.expectRevert(abi.encodeWithSelector(ISupplyChainFinance.ProgramExists.selector, PROGRAM));
        scf.createProgram(PROGRAM, funder, address(usdc), DISC_BPS, LIMIT);
    }

    function test_Revert_ApproveInvoice_NotAnchorBuyer() public {
        _createProgram();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ISupplyChainFinance.NotAnchorBuyer.selector, PROGRAM));
        scf.approveInvoice(INV, PROGRAM, BATCH, supplier, AMOUNT, dueDate);
    }

    function test_Revert_ApproveInvoice_NotAttested() public {
        _createProgram();
        att.setAttested(BATCH, false, 0);
        vm.prank(anchorBuyer);
        vm.expectRevert(abi.encodeWithSelector(ISupplyChainFinance.NotAttested.selector, BATCH));
        scf.approveInvoice(INV, PROGRAM, BATCH, supplier, AMOUNT, dueDate);
    }

    function test_DrawEarlyPayment_PaysDiscounted() public {
        _createProgram();
        _approve();

        uint256 discount = (AMOUNT * DISC_BPS) / 10_000; // 30e6
        uint256 paid = AMOUNT - discount; // 970e6

        vm.prank(supplier);
        scf.drawEarlyPayment(INV);

        assertEq(usdc.balanceOf(supplier), paid);
        assertEq(uint8(scf.invoiceOf(INV).state), uint8(ISupplyChainFinance.InvoiceState.EarlyPaid));
        assertEq(scf.programOf(PROGRAM).utilized, AMOUNT);
    }

    function test_Revert_DrawEarlyPayment_NotSupplier() public {
        _createProgram();
        _approve();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ISupplyChainFinance.NotSupplier.selector, INV));
        scf.drawEarlyPayment(INV);
    }

    function test_Revert_DrawEarlyPayment_LimitExceeded() public {
        vm.prank(anchorBuyer);
        scf.createProgram(PROGRAM, funder, address(usdc), DISC_BPS, 500e6); // small limit
        vm.prank(anchorBuyer);
        scf.approveInvoice(INV, PROGRAM, BATCH, supplier, AMOUNT, dueDate);
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(ISupplyChainFinance.LimitExceeded.selector, AMOUNT, 500e6));
        scf.drawEarlyPayment(INV);
    }

    function test_Settle_RepaysFunderAndFreesLimit() public {
        _createProgram();
        _approve();
        vm.prank(supplier);
        scf.drawEarlyPayment(INV);

        uint256 funderBefore = usdc.balanceOf(funder);
        vm.prank(anchorBuyer);
        scf.settle(INV);

        assertEq(uint8(scf.invoiceOf(INV).state), uint8(ISupplyChainFinance.InvoiceState.Settled));
        assertEq(usdc.balanceOf(funder), funderBefore + AMOUNT); // funder repaid in full
        assertEq(scf.programOf(PROGRAM).utilized, 0); // headroom freed
    }

    function test_Revert_Settle_NotAnchorBuyer() public {
        _createProgram();
        _approve();
        vm.prank(supplier);
        scf.drawEarlyPayment(INV);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ISupplyChainFinance.NotAnchorBuyer.selector, PROGRAM));
        scf.settle(INV);
    }

    function test_MarkOverdue_AfterDue() public {
        _createProgram();
        _approve();
        vm.warp(block.timestamp + 31 days);
        scf.markOverdue(INV);
        assertEq(uint8(scf.invoiceOf(INV).state), uint8(ISupplyChainFinance.InvoiceState.Overdue));
    }

    function test_Revert_MarkOverdue_NotYetDue() public {
        _createProgram();
        _approve();
        vm.expectRevert(abi.encodeWithSelector(SupplyChainFinance.NotYetDue.selector, INV, dueDate));
        scf.markOverdue(INV);
    }
}
