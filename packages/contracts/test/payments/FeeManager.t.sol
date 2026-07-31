// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Treasury } from "../../src/payments/Treasury.sol";
import { FeeManager } from "../../src/payments/FeeManager.sol";
import { IFeeManager } from "../../src/interfaces/IFeeManager.sol";
import { Keys } from "../../src/core/Keys.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";

contract FeeManagerTest is Test {
    AddressBook internal book;
    Treasury internal treasury;
    FeeManager internal feeManager;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal stranger = address(0xBEEF);
    address internal payer = address(0xBEEF01);

    bytes32 internal constant SETTLE = keccak256("SETTLE");
    uint256 internal constant AMOUNT = 1_000e6;

    event FeeBpsSet(bytes32 indexed action, uint16 bps);
    event FeeCollected(bytes32 indexed action, address indexed token, address indexed payer, uint256 amount);

    function setUp() public {
        book = new AddressBook(admin);
        treasury = new Treasury(address(book), admin);
        feeManager = new FeeManager(address(book), admin);
        usdc = new MockUSDC();

        vm.startPrank(admin);
        book.setAddress(Keys.TREASURY, address(treasury));
        feeManager.setFeeBps(SETTLE, 250); // 2.5%
        vm.stopPrank();

        usdc.mint(payer, AMOUNT);
        vm.prank(payer);
        usdc.approve(address(feeManager), AMOUNT);
    }

    function test_SetFeeBps_EmitsAndStores() public {
        vm.expectEmit(true, false, false, true);
        emit FeeBpsSet(SETTLE, 100);
        vm.prank(admin);
        feeManager.setFeeBps(SETTLE, 100);
        assertEq(feeManager.feeBps(SETTLE), 100);
    }

    function test_SetFeeBps_RevertsInvalidBps() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IFeeManager.InvalidBps.selector, uint16(10_001)));
        feeManager.setFeeBps(SETTLE, 10_001);
    }

    function test_SetFeeBps_RevertsUnauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, bytes32(0))
        );
        feeManager.setFeeBps(SETTLE, 100);
    }

    function test_FeeFor_Math() public view {
        assertEq(feeManager.feeFor(SETTLE, AMOUNT), 25e6); // 2.5% of 1000
        assertEq(feeManager.feeFor(SETTLE, 0), 0);
        assertEq(feeManager.feeFor(keccak256("UNSET"), AMOUNT), 0);
    }

    function test_Collect_PullsFeeToTreasury() public {
        vm.expectEmit(true, true, true, true);
        emit FeeCollected(SETTLE, address(usdc), payer, 25e6);
        uint256 fee = feeManager.collect(SETTLE, address(usdc), payer, AMOUNT);

        assertEq(fee, 25e6);
        assertEq(treasury.balanceOf(address(usdc)), 25e6);
        assertEq(usdc.balanceOf(address(treasury)), 25e6);
        assertEq(usdc.balanceOf(payer), AMOUNT - 25e6);
        // No residual allowance to the treasury remains.
        assertEq(usdc.allowance(address(feeManager), address(treasury)), 0);
    }

    function test_Collect_ZeroFeeIsNoOp() public {
        vm.prank(admin);
        feeManager.setFeeBps(SETTLE, 0);
        uint256 fee = feeManager.collect(SETTLE, address(usdc), payer, AMOUNT);
        assertEq(fee, 0);
        assertEq(treasury.balanceOf(address(usdc)), 0);
        assertEq(usdc.balanceOf(payer), AMOUNT);
    }

    function test_Collect_RevertsZeroToken() public {
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        feeManager.collect(SETTLE, address(0), payer, AMOUNT);
    }

    function test_Collect_RevertsZeroPayer() public {
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        feeManager.collect(SETTLE, address(usdc), address(0), AMOUNT);
    }
}
