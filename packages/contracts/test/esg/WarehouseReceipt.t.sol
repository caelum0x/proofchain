// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

import { Test } from "forge-std/Test.sol";

import { WarehouseReceipt } from "../../src/esg/WarehouseReceipt.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Roles } from "../../src/core/Roles.sol";
import { IWarehouseReceipt } from "../../src/interfaces/IWarehouseReceipt.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

contract WarehouseReceiptTest is Test {
    AddressBook internal book;
    WarehouseReceipt internal receipt;

    address internal admin = address(0xA11CE);
    address internal minter = address(0xB0B);
    address internal alice = address(0xA71CE);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant BATCH = keccak256("batch-1");

    event Issued(uint256 indexed tokenId, bytes32 indexed batchId, address indexed to, uint256 quantity, string location);
    event Redeemed(uint256 indexed tokenId, address indexed by);

    function setUp() public {
        book = new AddressBook(admin);
        receipt = new WarehouseReceipt(address(book), admin);

        vm.prank(admin);
        receipt.grantRole(Roles.MINTER_ROLE, minter);
    }

    function test_Issue_HappyPath() public {
        vm.expectEmit(true, true, true, true, address(receipt));
        emit Issued(1, BATCH, alice, 500, "Rotterdam");

        vm.prank(minter);
        uint256 tokenId = receipt.issue(BATCH, alice, 500, "Rotterdam");

        assertEq(tokenId, 1);
        assertEq(receipt.ownerOf(1), alice);

        IWarehouseReceipt.Receipt memory r = receipt.receiptOf(1);
        assertEq(r.tokenId, 1);
        assertEq(r.batchId, BATCH);
        assertEq(r.quantity, 500);
        assertEq(r.location, "Rotterdam");
        assertFalse(r.redeemed);
    }

    function test_Issue_SequentialIds() public {
        vm.startPrank(minter);
        uint256 a = receipt.issue(BATCH, alice, 10, "A");
        uint256 b = receipt.issue(BATCH, alice, 20, "B");
        vm.stopPrank();
        assertEq(a, 1);
        assertEq(b, 2);
        assertEq(receipt.balanceOf(alice), 2);
    }

    function test_Redeem_HappyPath() public {
        vm.prank(minter);
        uint256 tokenId = receipt.issue(BATCH, alice, 500, "Rotterdam");

        vm.expectEmit(true, true, false, false, address(receipt));
        emit Redeemed(tokenId, alice);

        vm.prank(alice);
        receipt.redeem(tokenId);

        // NFT burned, but historical record preserved and flagged redeemed.
        assertEq(receipt.balanceOf(alice), 0);
        assertTrue(receipt.receiptOf(tokenId).redeemed);
    }

    function test_RevertWhen_IssueToZero() public {
        vm.prank(minter);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        receipt.issue(BATCH, address(0), 500, "Rotterdam");
    }

    function test_RevertWhen_IssueZeroQuantity() public {
        vm.prank(minter);
        vm.expectRevert(IWarehouseReceipt.ZeroQuantity.selector);
        receipt.issue(BATCH, alice, 0, "Rotterdam");
    }

    function test_RevertWhen_NonMinterIssues() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.MINTER_ROLE)
        );
        receipt.issue(BATCH, alice, 500, "Rotterdam");
    }

    function test_RevertWhen_RedeemByNonOwner() public {
        vm.prank(minter);
        uint256 tokenId = receipt.issue(BATCH, alice, 500, "Rotterdam");

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IWarehouseReceipt.NotReceiptOwner.selector, tokenId));
        receipt.redeem(tokenId);
    }

    function test_RevertWhen_RedeemNonexistent() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IWarehouseReceipt.NotReceiptOwner.selector, uint256(42)));
        receipt.redeem(42);
    }

    function test_RevertWhen_RedeemTwice() public {
        vm.prank(minter);
        uint256 tokenId = receipt.issue(BATCH, alice, 500, "Rotterdam");

        vm.startPrank(alice);
        receipt.redeem(tokenId);
        vm.expectRevert(abi.encodeWithSelector(IWarehouseReceipt.AlreadyRedeemed.selector, tokenId));
        receipt.redeem(tokenId);
        vm.stopPrank();
    }
}
