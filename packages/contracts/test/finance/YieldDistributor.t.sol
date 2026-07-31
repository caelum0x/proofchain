// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { YieldDistributor } from "../../src/finance/YieldDistributor.sol";
import { IYieldDistributor } from "../../src/interfaces/IYieldDistributor.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";

contract YieldDistributorTest is Test {
    AddressBook internal book;
    YieldDistributor internal yd;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE); // holds KEEPER_ROLE
    address internal vaultSink = address(0x7A17);
    address internal stranger = address(0xDEAD);

    bytes32 internal constant POOL_ID = keccak256("pool-1");
    uint256 internal constant YIELD = 25e6;

    event YieldDistributed(bytes32 indexed poolId, address indexed token, uint256 amount);
    event YieldNotified(bytes32 indexed poolId, address indexed token, uint256 amount);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        yd = new YieldDistributor(address(book), admin);
        usdc = new MockUSDC();
        book.setAddress(Keys.LENDER_VAULT, vaultSink);
        vm.stopPrank();

        usdc.mint(admin, YIELD);
        vm.prank(admin);
        usdc.approve(address(yd), type(uint256).max);
    }

    function test_Notify_Accrues() public {
        vm.expectEmit(true, true, false, true);
        emit YieldNotified(POOL_ID, address(usdc), YIELD);
        vm.prank(admin);
        yd.notify(POOL_ID, address(usdc), YIELD);

        assertEq(yd.pendingYield(POOL_ID), YIELD);
        assertEq(yd.yieldToken(POOL_ID), address(usdc));
        assertEq(usdc.balanceOf(address(yd)), YIELD);
    }

    function test_Distribute_ToVault() public {
        vm.prank(admin);
        yd.notify(POOL_ID, address(usdc), YIELD);

        vm.expectEmit(true, true, false, true);
        emit YieldDistributed(POOL_ID, address(usdc), YIELD);
        yd.distribute(POOL_ID);

        assertEq(yd.pendingYield(POOL_ID), 0);
        assertEq(usdc.balanceOf(vaultSink), YIELD);
        assertEq(usdc.balanceOf(address(yd)), 0);
    }

    function test_Notify_Accumulates() public {
        usdc.mint(admin, YIELD); // now admin has 2*YIELD
        vm.startPrank(admin);
        yd.notify(POOL_ID, address(usdc), YIELD);
        yd.notify(POOL_ID, address(usdc), YIELD);
        vm.stopPrank();
        assertEq(yd.pendingYield(POOL_ID), 2 * YIELD);
    }

    // --- reverts ---

    function test_Revert_Notify_NotAuthorized() public {
        vm.prank(stranger);
        vm.expectRevert(YieldDistributor.NotAuthorized.selector);
        yd.notify(POOL_ID, address(usdc), YIELD);
    }

    function test_Revert_Notify_ZeroAmount() public {
        vm.prank(admin);
        vm.expectRevert(IYieldDistributor.ZeroAmount.selector);
        yd.notify(POOL_ID, address(usdc), 0);
    }

    function test_Revert_Notify_ZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        yd.notify(POOL_ID, address(0), YIELD);
    }

    function test_Revert_Notify_TokenMismatch() public {
        MockUSDC other = new MockUSDC();
        other.mint(admin, YIELD);
        vm.startPrank(admin);
        yd.notify(POOL_ID, address(usdc), YIELD);
        other.approve(address(yd), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(YieldDistributor.TokenMismatch.selector, POOL_ID));
        yd.notify(POOL_ID, address(other), YIELD);
        vm.stopPrank();
    }

    function test_Revert_Distribute_Nothing() public {
        vm.expectRevert(abi.encodeWithSelector(IYieldDistributor.NothingToDistribute.selector, POOL_ID));
        yd.distribute(POOL_ID);
    }
}
