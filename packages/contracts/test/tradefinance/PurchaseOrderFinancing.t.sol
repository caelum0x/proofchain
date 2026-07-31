// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { PurchaseOrderFinancing } from "../../src/tradefinance/PurchaseOrderFinancing.sol";
import { IPurchaseOrderFinancing } from "../../src/interfaces/IPurchaseOrderFinancing.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { MockAttestation } from "./mocks/MockAttestation.sol";

contract PurchaseOrderFinancingTest is Test {
    AddressBook internal book;
    PurchaseOrderFinancing internal po;
    MockAttestation internal att;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal supplier = address(0x5099);
    address internal buyer = address(0xB111);
    address internal financier = address(0xF1);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant PO = keccak256("po-1");
    bytes32 internal constant BATCH = keccak256("batch-1");
    uint256 internal constant PO_VALUE = 1_000e6;
    uint256 internal constant ADVANCE = 600e6;
    uint16 internal constant FEE_BPS = 500; // 5%
    uint64 internal dueDate;

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        po = new PurchaseOrderFinancing(address(book), admin);
        att = new MockAttestation();
        book.setAddress(Keys.ATTESTATION_REGISTRY, address(att));
        vm.stopPrank();

        usdc = new MockUSDC();
        att.setAttested(BATCH, true, 9600);
        dueDate = uint64(block.timestamp + 30 days);

        usdc.mint(financier, PO_VALUE * 10);
        usdc.mint(buyer, PO_VALUE * 10);
        vm.prank(financier);
        usdc.approve(address(po), type(uint256).max);
        vm.prank(buyer);
        usdc.approve(address(po), type(uint256).max);
    }

    function _register() internal {
        vm.prank(supplier);
        po.register(PO, BATCH, buyer, address(usdc), PO_VALUE, dueDate);
    }

    function _finance() internal {
        vm.prank(financier);
        po.finance(PO, ADVANCE, FEE_BPS);
    }

    function test_Register_Happy() public {
        _register();
        IPurchaseOrderFinancing.PO memory p = po.poOf(PO);
        assertEq(uint8(p.state), uint8(IPurchaseOrderFinancing.POState.Registered));
        assertEq(p.supplier, supplier);
        assertEq(p.poValue, PO_VALUE);
    }

    function test_Revert_Register_ZeroAmount() public {
        vm.prank(supplier);
        vm.expectRevert(IPurchaseOrderFinancing.ZeroAmount.selector);
        po.register(PO, BATCH, buyer, address(usdc), 0, dueDate);
    }

    function test_Finance_AdvancesToSupplier() public {
        _register();
        uint256 before = usdc.balanceOf(supplier);
        _finance();
        assertEq(usdc.balanceOf(supplier), before + ADVANCE);
        assertEq(uint8(po.poOf(PO).state), uint8(IPurchaseOrderFinancing.POState.Financed));
    }

    function test_Revert_Finance_AdvanceExceedsValue() public {
        _register();
        vm.prank(financier);
        vm.expectRevert(
            abi.encodeWithSelector(IPurchaseOrderFinancing.AdvanceExceedsValue.selector, PO_VALUE + 1, PO_VALUE)
        );
        po.finance(PO, PO_VALUE + 1, FEE_BPS);
    }

    function test_MarkDelivered_RequiresAttestation() public {
        _register();
        _finance();
        vm.prank(supplier);
        po.markDelivered(PO);
        assertEq(uint8(po.poOf(PO).state), uint8(IPurchaseOrderFinancing.POState.Delivered));
    }

    function test_Revert_MarkDelivered_NotAttested() public {
        att.setAttested(BATCH, false, 0);
        _register();
        _finance();
        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(IPurchaseOrderFinancing.NotAttested.selector, BATCH));
        po.markDelivered(PO);
    }

    function test_Repay_SplitsFinancierAndSupplier() public {
        _register();
        _finance();
        vm.prank(supplier);
        po.markDelivered(PO);

        uint256 fee = (ADVANCE * FEE_BPS) / 10_000; // 30e6
        uint256 financierTake = ADVANCE + fee; // 630e6
        uint256 surplus = PO_VALUE - financierTake; // 370e6

        uint256 finBefore = usdc.balanceOf(financier);
        uint256 supBefore = usdc.balanceOf(supplier);

        po.repay(PO);

        assertEq(uint8(po.poOf(PO).state), uint8(IPurchaseOrderFinancing.POState.Repaid));
        assertEq(usdc.balanceOf(financier), finBefore + financierTake);
        assertEq(usdc.balanceOf(supplier), supBefore + surplus);
        assertEq(usdc.balanceOf(address(po)), 0);
    }

    function test_MarkDefault_AfterDue() public {
        _register();
        _finance();
        vm.warp(block.timestamp + 31 days);
        vm.prank(financier);
        po.markDefault(PO);
        assertEq(uint8(po.poOf(PO).state), uint8(IPurchaseOrderFinancing.POState.Defaulted));
    }

    function test_Revert_MarkDefault_NotYetDue() public {
        _register();
        _finance();
        vm.prank(financier);
        vm.expectRevert(abi.encodeWithSelector(PurchaseOrderFinancing.NotYetDue.selector, PO, dueDate));
        po.markDefault(PO);
    }

    function test_Cancel_Unfinanced() public {
        _register();
        vm.prank(supplier);
        po.cancel(PO);
        assertEq(uint8(po.poOf(PO).state), uint8(IPurchaseOrderFinancing.POState.Cancelled));
    }

    function test_Revert_Cancel_NotSupplier() public {
        _register();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IPurchaseOrderFinancing.NotSupplier.selector, PO));
        po.cancel(PO);
    }
}
