// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Treasury } from "../../src/payments/Treasury.sol";
import { ITreasury } from "../../src/interfaces/ITreasury.sol";
import { Roles } from "../../src/core/Roles.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";

contract TreasuryTest is Test {
    AddressBook internal book;
    Treasury internal treasury;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal treasurer = address(0x7EA5);
    address internal depositor = address(0xD09);
    address internal stranger = address(0xBEEF);
    address internal recipient = address(0x600D);

    uint256 internal constant AMOUNT = 1_000e6;

    event Deposit(address indexed from, address indexed token, uint256 amount);
    event Withdraw(address indexed to, address indexed token, uint256 amount);

    function setUp() public {
        book = new AddressBook(admin);
        treasury = new Treasury(address(book), admin);
        usdc = new MockUSDC();

        vm.prank(admin);
        treasury.grantRole(Roles.TREASURER_ROLE, treasurer);

        usdc.mint(depositor, AMOUNT);
        vm.prank(depositor);
        usdc.approve(address(treasury), AMOUNT);
    }

    function test_Deposit_EmitsAndTracksBalance() public {
        vm.expectEmit(true, true, false, true);
        emit Deposit(depositor, address(usdc), AMOUNT);
        vm.prank(depositor);
        treasury.deposit(address(usdc), AMOUNT);

        assertEq(treasury.balanceOf(address(usdc)), AMOUNT);
        assertEq(usdc.balanceOf(address(treasury)), AMOUNT);
    }

    function test_Deposit_RevertsZeroToken() public {
        vm.prank(depositor);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        treasury.deposit(address(0), AMOUNT);
    }

    function test_Deposit_RevertsZeroAmount() public {
        vm.prank(depositor);
        vm.expectRevert(ITreasury.ZeroAmount.selector);
        treasury.deposit(address(usdc), 0);
    }

    function test_Withdraw_HappyPath() public {
        vm.prank(depositor);
        treasury.deposit(address(usdc), AMOUNT);

        vm.expectEmit(true, true, false, true);
        emit Withdraw(recipient, address(usdc), 400e6);
        vm.prank(treasurer);
        treasury.withdraw(address(usdc), recipient, 400e6);

        assertEq(treasury.balanceOf(address(usdc)), 600e6);
        assertEq(usdc.balanceOf(recipient), 400e6);
    }

    function test_Withdraw_RevertsUnauthorized() public {
        vm.prank(depositor);
        treasury.deposit(address(usdc), AMOUNT);

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.TREASURER_ROLE
            )
        );
        treasury.withdraw(address(usdc), recipient, AMOUNT);
    }

    function test_Withdraw_RevertsInsufficientBalance() public {
        vm.prank(depositor);
        treasury.deposit(address(usdc), AMOUNT);

        vm.prank(treasurer);
        vm.expectRevert(
            abi.encodeWithSelector(ITreasury.InsufficientBalance.selector, address(usdc), AMOUNT + 1, AMOUNT)
        );
        treasury.withdraw(address(usdc), recipient, AMOUNT + 1);
    }

    function test_Withdraw_RevertsZeroRecipient() public {
        vm.prank(depositor);
        treasury.deposit(address(usdc), AMOUNT);
        vm.prank(treasurer);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        treasury.withdraw(address(usdc), address(0), 1);
    }

    function test_AdminIsInitialTreasurer() public {
        vm.prank(depositor);
        treasury.deposit(address(usdc), AMOUNT);
        // admin got TREASURER_ROLE in the constructor.
        vm.prank(admin);
        treasury.withdraw(address(usdc), recipient, AMOUNT);
        assertEq(usdc.balanceOf(recipient), AMOUNT);
    }
}
