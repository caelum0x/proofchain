// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { StakeManager } from "../../src/reputation/StakeManager.sol";
import { ArbiterStaking } from "../../src/governance/ArbiterStaking.sol";
import { IArbiterStaking } from "../../src/interfaces/IArbiterStaking.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";

contract ArbiterStakingTest is Test {
    AddressBook internal book;
    StakeManager internal sm;
    ArbiterStaking internal arb;
    MockUSDC internal token;

    address internal admin = address(0xA11CE);
    address internal disputeModule = address(0xD1595);
    address internal alice = address(0xA11);

    uint256 internal constant MIN_STAKE = 100e6;
    uint256 internal constant GENERIC_STAKE = 500e6;

    event ArbiterStaked(address indexed arbiter, uint256 amount);
    event ArbiterUnstaked(address indexed arbiter, uint256 amount);
    event MinStakeUpdated(uint256 minStake);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        sm = new StakeManager(address(book), admin);
        arb = new ArbiterStaking(address(book), admin, MIN_STAKE);

        book.setAddress(Keys.STAKE_MANAGER, address(sm));
        book.setAddress(Keys.ARBITER_STAKING, address(arb));
        book.setAddress(Keys.DISPUTE_ARBITRATION, disputeModule);

        // ArbiterStaking must be able to lock/unlock generic stake.
        sm.grantRole(sm.STAKE_CONTROLLER_ROLE(), address(arb));
        vm.stopPrank();

        token = new MockUSDC();
        token.mint(alice, GENERIC_STAKE);
        vm.startPrank(alice);
        token.approve(address(sm), type(uint256).max);
        sm.stake(address(token), GENERIC_STAKE);
        vm.stopPrank();
    }

    function _stakeArbiter(uint256 amount) internal {
        vm.prank(alice);
        arb.stakeArbiter(amount);
    }

    // --- construction ---

    function test_Constructor_RevertsZeroAddress() public {
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        new ArbiterStaking(address(0), admin, MIN_STAKE);
    }

    function test_Constructor_SetsMinStake() public view {
        assertEq(arb.minStake(), MIN_STAKE);
    }

    // --- stakeArbiter ---

    function test_StakeArbiter_HappyPath() public {
        vm.expectEmit(true, false, false, true);
        emit ArbiterStaked(alice, 200e6);
        _stakeArbiter(200e6);

        assertEq(arb.stakeOf(alice), 200e6);
        assertTrue(arb.isArbiter(alice));
        assertEq(sm.lockedOf(alice), 200e6);
    }

    function test_StakeArbiter_RevertsZeroAmount() public {
        vm.expectRevert(IArbiterStaking.ZeroAmount.selector);
        _stakeArbiter(0);
    }

    function test_StakeArbiter_RevertsInsufficientUnlocked() public {
        vm.expectRevert(
            abi.encodeWithSelector(ArbiterStaking.InsufficientUnlockedStake.selector, GENERIC_STAKE, GENERIC_STAKE + 1)
        );
        _stakeArbiter(GENERIC_STAKE + 1);
    }

    function test_StakeArbiter_RevertsBelowMinStake() public {
        vm.expectRevert(abi.encodeWithSelector(IArbiterStaking.BelowMinStake.selector, 50e6, MIN_STAKE));
        _stakeArbiter(50e6);
    }

    function test_StakeArbiter_Accumulates() public {
        _stakeArbiter(120e6);
        _stakeArbiter(80e6);
        assertEq(arb.stakeOf(alice), 200e6);
        assertEq(sm.lockedOf(alice), 200e6);
        assertTrue(arb.isArbiter(alice));
    }

    // --- unstakeArbiter ---

    function test_UnstakeArbiter_HappyPath() public {
        _stakeArbiter(300e6);
        vm.expectEmit(true, false, false, true);
        emit ArbiterUnstaked(alice, 100e6);
        vm.prank(alice);
        arb.unstakeArbiter(100e6);

        assertEq(arb.stakeOf(alice), 200e6);
        assertEq(sm.lockedOf(alice), 200e6);
        assertEq(sm.unlockedOf(alice), GENERIC_STAKE - 200e6);
    }

    function test_UnstakeArbiter_RevertsZeroAmount() public {
        _stakeArbiter(200e6);
        vm.prank(alice);
        vm.expectRevert(IArbiterStaking.ZeroAmount.selector);
        arb.unstakeArbiter(0);
    }

    function test_UnstakeArbiter_RevertsInsufficientArbiterStake() public {
        _stakeArbiter(200e6);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ArbiterStaking.InsufficientArbiterStake.selector, 200e6, 300e6));
        arb.unstakeArbiter(300e6);
    }

    function test_UnstakeArbiter_RevertsWhenVotesPending() public {
        _stakeArbiter(200e6);
        // Simulate an unresolved vote lock from the dispute module.
        vm.prank(disputeModule);
        arb.onVoteCast(alice);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IArbiterStaking.StakeLocked.selector, alice));
        arb.unstakeArbiter(100e6);
    }

    // --- coordination hooks ---

    function test_Hooks_RevertWhenNotDisputeModule() public {
        vm.expectRevert(abi.encodeWithSelector(ArbiterStaking.NotDisputeModule.selector, alice));
        vm.prank(alice);
        arb.onVoteCast(alice);
    }

    function test_Hooks_VoteLockLifecycle() public {
        _stakeArbiter(200e6);
        vm.startPrank(disputeModule);
        arb.onVoteCast(alice);
        arb.onVoteCast(alice);
        assertEq(arb.pendingVotesOf(alice), 2);
        arb.onDisputeResolved(alice);
        assertEq(arb.pendingVotesOf(alice), 1);
        arb.onDisputeResolved(alice);
        assertEq(arb.pendingVotesOf(alice), 0);
        // Underflow-guarded: extra resolve is a no-op.
        arb.onDisputeResolved(alice);
        assertEq(arb.pendingVotesOf(alice), 0);
        vm.stopPrank();
    }

    function test_OnArbiterSlashed_ReducesCommittedStake() public {
        _stakeArbiter(200e6);
        vm.prank(disputeModule);
        arb.onArbiterSlashed(alice, 50e6);
        assertEq(arb.stakeOf(alice), 150e6);

        // Slashing beyond committed floors at zero.
        vm.prank(disputeModule);
        arb.onArbiterSlashed(alice, 1000e6);
        assertEq(arb.stakeOf(alice), 0);
        assertFalse(arb.isArbiter(alice));
    }

    // --- admin ---

    function test_SetMinStake_UpdatesAndEmits() public {
        vm.expectEmit(false, false, false, true);
        emit MinStakeUpdated(250e6);
        vm.prank(admin);
        arb.setMinStake(250e6);
        assertEq(arb.minStake(), 250e6);
    }

    function test_SetMinStake_RevertsWhenNotAdmin() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, alice, arb.DEFAULT_ADMIN_ROLE()
            )
        );
        vm.prank(alice);
        arb.setMinStake(250e6);
    }

    function test_IsArbiter_FalseBelowMin() public {
        _stakeArbiter(200e6);
        assertTrue(arb.isArbiter(alice));
        // Raise the floor above the committed stake.
        vm.prank(admin);
        arb.setMinStake(300e6);
        assertFalse(arb.isArbiter(alice));
    }
}
