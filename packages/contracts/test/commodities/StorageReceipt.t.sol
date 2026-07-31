// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { StorageReceipt } from "../../src/commodities/StorageReceipt.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { IStorageReceipt } from "../../src/interfaces/IStorageReceipt.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

contract StorageReceiptTest is Test {
    AddressBook internal book;
    StorageReceipt internal receipts;

    address internal admin = address(0xA11CE);
    address internal operator = address(0x09E);
    address internal alice = address(0xA71CE);
    address internal bob = address(0xB0B);
    address internal lender = address(0x1E4D);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant R = keccak256("receipt-1");
    bytes32 internal constant WH = keccak256("warehouse-1");
    bytes32 internal constant CODE = keccak256("ARABICA-A");
    bytes32 internal constant GRADE = keccak256("A");

    event ReceiptIssued(
        bytes32 indexed receiptId,
        bytes32 indexed warehouseId,
        address indexed holder,
        bytes32 commodityCode,
        uint256 quantityKg
    );
    event ReceiptTransferred(bytes32 indexed receiptId, address indexed from, address indexed to);
    event LienPlaced(bytes32 indexed receiptId, address indexed lienHolder);
    event LienReleased(bytes32 indexed receiptId, address indexed lienHolder);
    event ReceiptRedeemed(bytes32 indexed receiptId, address indexed holder);
    event ReceiptCancelled(bytes32 indexed receiptId, bytes32 reason);

    function setUp() public {
        book = new AddressBook(admin);
        receipts = new StorageReceipt(address(book), admin);
        vm.prank(admin);
        receipts.grantRole(Roles.REGISTRAR_ROLE, operator);
    }

    function _issue() internal {
        vm.prank(operator);
        receipts.issue(R, WH, alice, CODE, GRADE, 5000, 0);
    }

    function test_Issue_HappyPath() public {
        vm.expectEmit(true, true, true, true, address(receipts));
        emit ReceiptIssued(R, WH, alice, CODE, 5000);
        _issue();

        IStorageReceipt.Receipt memory r = receipts.receiptOf(R);
        assertEq(r.holder, alice);
        assertEq(r.commodityCode, CODE);
        assertEq(r.quantityKg, 5000);
        assertEq(uint8(r.state), uint8(IStorageReceipt.ReceiptState.Issued));
        assertEq(r.lienHolder, address(0));
    }

    function test_RevertWhen_NonRegistrarIssues() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.REGISTRAR_ROLE
            )
        );
        receipts.issue(R, WH, alice, CODE, GRADE, 5000, 0);
    }

    function test_RevertWhen_IssueZeroHolder() public {
        vm.prank(operator);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        receipts.issue(R, WH, address(0), CODE, GRADE, 5000, 0);
    }

    function test_RevertWhen_IssueZeroQuantity() public {
        vm.prank(operator);
        vm.expectRevert(IStorageReceipt.ZeroQuantity.selector);
        receipts.issue(R, WH, alice, CODE, GRADE, 0, 0);
    }

    function test_RevertWhen_IssueDuplicate() public {
        _issue();
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(IStorageReceipt.ReceiptExists.selector, R));
        receipts.issue(R, WH, alice, CODE, GRADE, 5000, 0);
    }

    function test_Transfer_HappyPath() public {
        _issue();
        vm.expectEmit(true, true, true, false, address(receipts));
        emit ReceiptTransferred(R, alice, bob);

        vm.prank(alice);
        receipts.transfer(R, bob);
        assertEq(receipts.receiptOf(R).holder, bob);
    }

    function test_RevertWhen_TransferByNonHolder() public {
        _issue();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IStorageReceipt.NotHolder.selector, R));
        receipts.transfer(R, bob);
    }

    function test_RevertWhen_TransferUnknown() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IStorageReceipt.UnknownReceipt.selector, R));
        receipts.transfer(R, bob);
    }

    function test_Pledge_And_ReleaseLien() public {
        _issue();
        vm.expectEmit(true, true, false, false, address(receipts));
        emit LienPlaced(R, lender);
        vm.prank(alice);
        receipts.pledge(R, lender);

        IStorageReceipt.Receipt memory r = receipts.receiptOf(R);
        assertEq(uint8(r.state), uint8(IStorageReceipt.ReceiptState.Pledged));
        assertEq(r.lienHolder, lender);

        vm.expectEmit(true, true, false, false, address(receipts));
        emit LienReleased(R, lender);
        vm.prank(lender);
        receipts.releaseLien(R);

        r = receipts.receiptOf(R);
        assertEq(uint8(r.state), uint8(IStorageReceipt.ReceiptState.Issued));
        assertEq(r.lienHolder, address(0));
    }

    function test_RevertWhen_TransferEncumbered() public {
        _issue();
        vm.prank(alice);
        receipts.pledge(R, lender);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IStorageReceipt.Encumbered.selector, R));
        receipts.transfer(R, bob);
    }

    function test_RevertWhen_PledgeTwice() public {
        _issue();
        vm.prank(alice);
        receipts.pledge(R, lender);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IStorageReceipt.InvalidState.selector,
                R,
                IStorageReceipt.ReceiptState.Issued,
                IStorageReceipt.ReceiptState.Pledged
            )
        );
        receipts.pledge(R, lender);
    }

    function test_RevertWhen_ReleaseLienByNonLienHolder() public {
        _issue();
        vm.prank(alice);
        receipts.pledge(R, lender);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IStorageReceipt.NotLienHolder.selector, R));
        receipts.releaseLien(R);
    }

    function test_Redeem_HappyPath() public {
        _issue();
        vm.expectEmit(true, true, false, false, address(receipts));
        emit ReceiptRedeemed(R, alice);
        vm.prank(operator);
        receipts.redeem(R);
        assertEq(uint8(receipts.receiptOf(R).state), uint8(IStorageReceipt.ReceiptState.Redeemed));
    }

    function test_RevertWhen_RedeemEncumbered() public {
        _issue();
        vm.prank(alice);
        receipts.pledge(R, lender);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(IStorageReceipt.Encumbered.selector, R));
        receipts.redeem(R);
    }

    function test_RevertWhen_RedeemByNonOperator() public {
        _issue();
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, alice, Roles.REGISTRAR_ROLE
            )
        );
        receipts.redeem(R);
    }

    function test_Cancel_HappyPath() public {
        _issue();
        vm.expectEmit(true, false, false, true, address(receipts));
        emit ReceiptCancelled(R, keccak256("lost"));
        vm.prank(operator);
        receipts.cancel(R, keccak256("lost"));
        assertEq(uint8(receipts.receiptOf(R).state), uint8(IStorageReceipt.ReceiptState.Cancelled));
    }

    function test_RevertWhen_CancelEncumbered() public {
        _issue();
        vm.prank(alice);
        receipts.pledge(R, lender);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(IStorageReceipt.Encumbered.selector, R));
        receipts.cancel(R, keccak256("lost"));
    }
}
