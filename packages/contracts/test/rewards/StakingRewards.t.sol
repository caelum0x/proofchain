// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { Roles } from "../../src/core/Roles.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { StakingRewards } from "../../src/rewards/StakingRewards.sol";
import { IStakingRewards } from "../../src/interfaces/IStakingRewards.sol";
import { EmissionsController } from "../../src/rewards/EmissionsController.sol";
import { GovernanceToken } from "../../src/governance/GovernanceToken.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { ReenterERC20 } from "./mocks/ReenterERC20.sol";

contract StakingRewardsTest is Test {
    AddressBook internal book;
    EmissionsController internal emissions;
    GovernanceToken internal proof;
    StakingRewards internal sr;
    MockUSDC internal stakingToken;

    address internal admin = address(0xA11CE);
    address internal alice = address(0xA11);
    address internal bob = address(0xB0B);

    uint256 internal constant RATE = 1e15; // reward tokens per second
    uint256 internal constant STAKE_A = 1_000e6;
    uint256 internal constant STAKE_B = 3_000e6;

    event Staked(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event RewardPaid(address indexed account, uint256 reward);

    function setUp() public {
        stakingToken = new MockUSDC();

        vm.startPrank(admin);
        book = new AddressBook(admin);
        emissions = new EmissionsController(address(book), admin, admin);
        book.setAddress(Keys.EMISSIONS_CONTROLLER, address(emissions));
        proof = new GovernanceToken(admin, admin);
        book.setAddress(Keys.GOVERNANCE_TOKEN, address(proof));
        emissions.setEmissionRate(RATE);
        sr = new StakingRewards(address(book), admin, address(stakingToken));
        proof.grantRole(Roles.MINTER_ROLE, address(sr));
        vm.stopPrank();

        stakingToken.mint(alice, STAKE_A);
        stakingToken.mint(bob, STAKE_B);
        vm.prank(alice);
        stakingToken.approve(address(sr), type(uint256).max);
        vm.prank(bob);
        stakingToken.approve(address(sr), type(uint256).max);
    }

    // --- construction ---

    function test_Constructor_CachesRate() public view {
        assertEq(sr.rewardRate(), RATE);
        assertEq(address(sr.stakingToken()), address(stakingToken));
    }

    function test_Constructor_RevertsZeroStakingToken() public {
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        new StakingRewards(address(book), admin, address(0));
    }

    // --- stake ---

    function test_Stake_HappyPath() public {
        vm.expectEmit(true, false, false, true);
        emit Staked(alice, STAKE_A);
        vm.prank(alice);
        sr.stake(STAKE_A);
        assertEq(sr.stakedOf(alice), STAKE_A);
        assertEq(sr.totalStaked(), STAKE_A);
        assertEq(stakingToken.balanceOf(address(sr)), STAKE_A);
    }

    function test_Stake_RevertsZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(IStakingRewards.ZeroAmount.selector);
        sr.stake(0);
    }

    // --- reward accrual ---

    function test_Earned_SingleStaker() public {
        vm.prank(alice);
        sr.stake(STAKE_A);
        vm.warp(block.timestamp + 100);
        // Sole staker earns the entire emission over the window regardless of stake size.
        assertEq(sr.earned(alice), 100 * RATE);
    }

    function test_Earned_ProportionalSplit() public {
        vm.prank(alice);
        sr.stake(STAKE_A); // 1/4 of pool
        vm.prank(bob);
        sr.stake(STAKE_B); // 3/4 of pool
        vm.warp(block.timestamp + 100);
        assertEq(sr.earned(alice), 25 * RATE);
        assertEq(sr.earned(bob), 75 * RATE);
    }

    function test_GetReward_MintsProof() public {
        vm.prank(alice);
        sr.stake(STAKE_A);
        vm.warp(block.timestamp + 100);

        vm.expectEmit(true, false, false, true);
        emit RewardPaid(alice, 100 * RATE);
        vm.prank(alice);
        sr.getReward();

        assertEq(proof.balanceOf(alice), 100 * RATE);
        assertEq(sr.earned(alice), 0);
    }

    function test_GetReward_NoOpWhenNothingEarned() public {
        vm.prank(alice);
        sr.stake(STAKE_A);
        vm.prank(alice);
        sr.getReward(); // same block, zero elapsed
        assertEq(proof.balanceOf(alice), 0);
    }

    // --- withdraw ---

    function test_Withdraw_HappyPath() public {
        vm.prank(alice);
        sr.stake(STAKE_A);
        vm.warp(block.timestamp + 100);

        vm.expectEmit(true, false, false, true);
        emit Withdrawn(alice, 400e6);
        vm.prank(alice);
        sr.withdraw(400e6);

        assertEq(sr.stakedOf(alice), 600e6);
        assertEq(stakingToken.balanceOf(alice), 400e6);
        // Accrued reward is preserved across withdrawal.
        assertEq(sr.earned(alice), 100 * RATE);
    }

    function test_Withdraw_RevertsZeroAmount() public {
        vm.prank(alice);
        sr.stake(STAKE_A);
        vm.prank(alice);
        vm.expectRevert(IStakingRewards.ZeroAmount.selector);
        sr.withdraw(0);
    }

    function test_Withdraw_RevertsInsufficientStaked() public {
        vm.prank(alice);
        sr.stake(STAKE_A);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IStakingRewards.InsufficientStaked.selector, alice, STAKE_A + 1, STAKE_A));
        sr.withdraw(STAKE_A + 1);
    }

    // --- exit ---

    function test_Exit_WithdrawsAllAndClaims() public {
        vm.prank(alice);
        sr.stake(STAKE_A);
        vm.warp(block.timestamp + 100);

        vm.prank(alice);
        sr.exit();

        assertEq(sr.stakedOf(alice), 0);
        assertEq(sr.totalStaked(), 0);
        assertEq(stakingToken.balanceOf(alice), STAKE_A);
        assertEq(proof.balanceOf(alice), 100 * RATE);
    }

    // --- emission rate sync ---

    function test_SyncRewardRate_SettlesAtOldRateThenAdoptsNew() public {
        vm.prank(alice);
        sr.stake(STAKE_A);
        vm.warp(block.timestamp + 50); // 50 * RATE accrued

        vm.prank(admin);
        emissions.setEmissionRate(2 * RATE);
        sr.syncRewardRate();
        assertEq(sr.rewardRate(), 2 * RATE);

        vm.warp(block.timestamp + 50); // 50 * 2*RATE accrued at new rate
        // 50*RATE (old) + 100*RATE (new) = 150*RATE.
        assertEq(sr.earned(alice), 150 * RATE);
    }

    // --- reentrancy (money-movement safety) ---

    function test_Withdraw_ReentrancyBlocked() public {
        ReenterERC20 evil = new ReenterERC20();
        vm.prank(admin);
        StakingRewards sr2 = new StakingRewards(address(book), admin, address(evil));

        evil.mint(alice, STAKE_A);
        vm.startPrank(alice);
        evil.approve(address(sr2), type(uint256).max);
        sr2.stake(STAKE_A);
        vm.stopPrank();

        evil.arm(address(sr2), abi.encodeWithSelector(sr2.withdraw.selector, uint256(100e6)));
        vm.prank(alice);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        sr2.withdraw(100e6);
    }
}
