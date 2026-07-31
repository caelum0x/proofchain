// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { CommodityVault } from "../../src/commodities/CommodityVault.sol";
import { CommodityToken } from "../../src/commodities/CommodityToken.sol";
import { StorageReceipt } from "../../src/commodities/StorageReceipt.sol";
import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ICommodityVault } from "../../src/interfaces/ICommodityVault.sol";
import { ICommodityToken } from "../../src/interfaces/ICommodityToken.sol";
import { IStorageReceipt } from "../../src/interfaces/IStorageReceipt.sol";

contract CommodityVaultTest is Test {
    AddressBook internal book;
    CommodityToken internal token;
    StorageReceipt internal receipts;
    CommodityVault internal vault;

    address internal admin = address(0xA11CE);
    address internal operator = address(0x09E);
    address internal alice = address(0xA71CE);
    address internal bob = address(0xB0B);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant R = keccak256("receipt-1");
    bytes32 internal constant WH = keccak256("warehouse-1");
    bytes32 internal constant CODE = keccak256("ARABICA-A");
    bytes32 internal constant GRADE = keccak256("A");
    bytes32 internal constant OTHER_CODE = keccak256("ROBUSTA-B");

    uint256 internal constant QTY = 5000;
    uint256 internal EXPECTED; // QTY * 1e18

    event Deposited(
        bytes32 indexed receiptId, address indexed holder, bytes32 indexed commodityCode, uint256 tokenAmount
    );
    event Redeemed(bytes32 indexed receiptId, address indexed holder, uint256 tokenAmount);

    function setUp() public {
        book = new AddressBook(admin);
        token = new CommodityToken(address(book), admin, "ProofChain Arabica A", "cARAB-A", CODE, GRADE);
        receipts = new StorageReceipt(address(book), admin);
        vault = new CommodityVault(address(book), admin);

        vm.startPrank(admin);
        book.setAddress(Keys.COMMODITY_TOKEN, address(token));
        book.setAddress(Keys.STORAGE_RECEIPT, address(receipts));
        book.setAddress(Keys.COMMODITY_VAULT, address(vault));
        receipts.grantRole(Roles.REGISTRAR_ROLE, operator);
        vm.stopPrank();

        EXPECTED = QTY * 1e18;
    }

    function _issueTo(address holder, bytes32 code, uint64 expiresAt) internal {
        vm.prank(operator);
        receipts.issue(R, WH, holder, code, GRADE, QTY, expiresAt);
    }

    function _pledgeAndDeposit() internal returns (uint256) {
        _issueTo(alice, CODE, 0);
        vm.prank(alice);
        receipts.pledge(R, address(vault));
        vm.prank(alice);
        return vault.deposit(R);
    }

    function test_Deposit_MintsBackingTokens() public {
        _issueTo(alice, CODE, 0);
        vm.prank(alice);
        receipts.pledge(R, address(vault));

        vm.expectEmit(true, true, true, true, address(vault));
        emit Deposited(R, alice, CODE, EXPECTED);
        vm.prank(alice);
        uint256 amount = vault.deposit(R);

        assertEq(amount, EXPECTED);
        assertEq(token.balanceOf(alice), EXPECTED);
        assertEq(vault.totalBacked(), EXPECTED);
        // Full backing: token supply matches vault-tracked backing.
        assertEq(token.totalSupply(), vault.totalBacked());

        ICommodityVault.Position memory p = vault.positionOf(R);
        assertEq(p.holder, alice);
        assertEq(p.tokenAmount, EXPECTED);
        assertEq(uint8(p.state), uint8(ICommodityVault.PositionState.Collateralized));
    }

    function test_RevertWhen_DepositByNonHolder() public {
        _issueTo(alice, CODE, 0);
        vm.prank(alice);
        receipts.pledge(R, address(vault));
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ICommodityVault.NotHolder.selector, R));
        vault.deposit(R);
    }

    function test_RevertWhen_DepositNotPledged() public {
        _issueTo(alice, CODE, 0);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ICommodityVault.ReceiptNotEligible.selector, R));
        vault.deposit(R);
    }

    function test_RevertWhen_DepositPledgedToOther() public {
        _issueTo(alice, CODE, 0);
        vm.prank(alice);
        receipts.pledge(R, bob); // lien held by someone other than the vault
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ICommodityVault.ReceiptNotEligible.selector, R));
        vault.deposit(R);
    }

    function test_RevertWhen_DepositCommodityMismatch() public {
        _issueTo(alice, OTHER_CODE, 0);
        vm.prank(alice);
        receipts.pledge(R, address(vault));
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ICommodityVault.ReceiptNotEligible.selector, R));
        vault.deposit(R);
    }

    function test_RevertWhen_DepositExpiredReceipt() public {
        _issueTo(alice, CODE, uint64(block.timestamp + 100));
        vm.prank(alice);
        receipts.pledge(R, address(vault));
        vm.warp(block.timestamp + 101);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ICommodityVault.ReceiptNotEligible.selector, R));
        vault.deposit(R);
    }

    function test_RevertWhen_DepositTwice() public {
        _pledgeAndDeposit();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ICommodityVault.PositionExists.selector, R));
        vault.deposit(R);
    }

    function test_Redeem_BurnsAndReleasesLien() public {
        _pledgeAndDeposit();

        vm.expectEmit(true, true, false, true, address(vault));
        emit Redeemed(R, alice, EXPECTED);
        vm.prank(alice);
        vault.redeem(R);

        assertEq(token.balanceOf(alice), 0);
        assertEq(token.totalSupply(), 0);
        assertEq(vault.totalBacked(), 0);
        assertEq(uint8(vault.positionOf(R).state), uint8(ICommodityVault.PositionState.Redeemed));
        // Lien released: the receipt is back to Issued so it can be physically withdrawn.
        assertEq(uint8(receipts.receiptOf(R).state), uint8(IStorageReceipt.ReceiptState.Issued));
        assertEq(receipts.receiptOf(R).lienHolder, address(0));
    }

    function test_RevertWhen_RedeemByNonHolder() public {
        _pledgeAndDeposit();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ICommodityVault.NotHolder.selector, R));
        vault.redeem(R);
    }

    function test_RevertWhen_RedeemUnknownPosition() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ICommodityVault.UnknownPosition.selector, R));
        vault.redeem(R);
    }

    function test_RevertWhen_RedeemWithoutTokens() public {
        _pledgeAndDeposit();
        // Alice moved her backing tokens away and can no longer cover the burn.
        vm.prank(alice);
        token.transfer(bob, EXPECTED);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ICommodityToken.InsufficientBalance.selector, alice, EXPECTED, 0));
        vault.redeem(R);
    }

    function test_RevertWhen_RedeemTwice() public {
        _pledgeAndDeposit();
        vm.prank(alice);
        vault.redeem(R);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICommodityVault.InvalidState.selector,
                R,
                ICommodityVault.PositionState.Collateralized,
                ICommodityVault.PositionState.Redeemed
            )
        );
        vault.redeem(R);
    }
}
