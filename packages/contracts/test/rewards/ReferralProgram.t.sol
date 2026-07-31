// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { AddressBook } from "../../src/core/AddressBook.sol";
import { Keys } from "../../src/core/Keys.sol";
import { ProofChainAccess } from "../../src/core/ProofChainAccess.sol";
import { ReferralProgram } from "../../src/rewards/ReferralProgram.sol";
import { IReferralProgram } from "../../src/interfaces/IReferralProgram.sol";
import { GovernanceToken } from "../../src/governance/GovernanceToken.sol";
import { ReenterERC20 } from "./mocks/ReenterERC20.sol";

contract ReferralProgramTest is Test {
    AddressBook internal book;
    ReferralProgram internal referral;
    GovernanceToken internal proof;

    address internal admin = address(0xA11CE);
    address internal recorder = address(0x2EC02DE2);
    address internal referrer = address(0x8EF);
    address internal referee = address(0x8EE);
    address internal stranger = address(0xDEAD);

    uint256 internal constant REWARD_BPS = 1_000; // 10%
    uint256 internal constant FUND = 1_000_000e18;

    event Referred(address indexed referrer, address indexed referee);
    event ConversionRecorded(address indexed referee, uint256 value, uint256 reward);
    event ReferralClaimed(address indexed referrer, uint256 amount);

    function setUp() public {
        vm.startPrank(admin);
        book = new AddressBook(admin);
        proof = new GovernanceToken(admin, admin);
        book.setAddress(Keys.GOVERNANCE_TOKEN, address(proof));
        referral = new ReferralProgram(address(book), admin, REWARD_BPS);
        referral.grantRole(referral.CONVERSION_RECORDER_ROLE(), recorder);
        proof.mint(address(referral), FUND); // pre-fund payouts
        vm.stopPrank();
    }

    // --- construction ---

    function test_Constructor_InitialState() public view {
        assertEq(referral.rewardBps(), REWARD_BPS);
        assertTrue(referral.hasRole(referral.DEFAULT_ADMIN_ROLE(), admin));
    }

    function test_Constructor_RevertsBadBps() public {
        vm.expectRevert(abi.encodeWithSelector(ReferralProgram.InvalidBps.selector, 10_001));
        new ReferralProgram(address(book), admin, 10_001);
    }

    // --- refer ---

    function test_Refer_HappyPath() public {
        vm.expectEmit(true, true, false, false);
        emit Referred(referrer, referee);
        vm.prank(referee);
        referral.refer(referrer);
        assertEq(referral.referrerOf(referee), referrer);
    }

    function test_Refer_RevertsZeroReferrer() public {
        vm.prank(referee);
        vm.expectRevert(ProofChainAccess.ZeroAddress.selector);
        referral.refer(address(0));
    }

    function test_Refer_RevertsSelfReferral() public {
        vm.prank(referee);
        vm.expectRevert(abi.encodeWithSelector(IReferralProgram.SelfReferral.selector, referee));
        referral.refer(referee);
    }

    function test_Refer_RevertsAlreadyReferred() public {
        vm.startPrank(referee);
        referral.refer(referrer);
        vm.expectRevert(abi.encodeWithSelector(IReferralProgram.AlreadyReferred.selector, referee));
        referral.refer(address(0x1234));
        vm.stopPrank();
    }

    // --- recordConversion ---

    function test_RecordConversion_AccruesReward() public {
        vm.prank(referee);
        referral.refer(referrer);

        vm.expectEmit(true, false, false, true);
        emit ConversionRecorded(referee, 1_000e18, 100e18);
        vm.prank(recorder);
        referral.recordConversion(referee, 1_000e18);
        assertEq(referral.pendingReward(referrer), 100e18);
    }

    function test_RecordConversion_Accumulates() public {
        vm.prank(referee);
        referral.refer(referrer);
        vm.startPrank(recorder);
        referral.recordConversion(referee, 1_000e18);
        referral.recordConversion(referee, 500e18);
        vm.stopPrank();
        assertEq(referral.pendingReward(referrer), 150e18);
    }

    function test_RecordConversion_NoReferrerYieldsZero() public {
        // referee never called refer -> no attribution, zero reward, no revert.
        vm.expectEmit(true, false, false, true);
        emit ConversionRecorded(referee, 1_000e18, 0);
        vm.prank(recorder);
        referral.recordConversion(referee, 1_000e18);
        assertEq(referral.pendingReward(referrer), 0);
    }

    function test_RecordConversion_RevertsUnauthorized() public {
        bytes32 _role = referral.CONVERSION_RECORDER_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, _role
            )
        );
        referral.recordConversion(referee, 1_000e18);
    }

    function test_RecordConversion_RevertsZeroValue() public {
        vm.prank(recorder);
        vm.expectRevert(ReferralProgram.ZeroAmount.selector);
        referral.recordConversion(referee, 0);
    }

    // --- claimReferral ---

    function test_ClaimReferral_HappyPath() public {
        vm.prank(referee);
        referral.refer(referrer);
        vm.prank(recorder);
        referral.recordConversion(referee, 1_000e18);

        vm.expectEmit(true, false, false, true);
        emit ReferralClaimed(referrer, 100e18);
        vm.prank(referrer);
        referral.claimReferral();

        assertEq(proof.balanceOf(referrer), 100e18);
        assertEq(referral.pendingReward(referrer), 0);
        assertEq(proof.balanceOf(address(referral)), FUND - 100e18);
    }

    function test_ClaimReferral_RevertsNothingToClaim() public {
        vm.prank(referrer);
        vm.expectRevert(abi.encodeWithSelector(IReferralProgram.NothingToClaim.selector, referrer));
        referral.claimReferral();
    }

    function test_ClaimReferral_CannotDoubleClaim() public {
        vm.prank(referee);
        referral.refer(referrer);
        vm.prank(recorder);
        referral.recordConversion(referee, 1_000e18);
        vm.startPrank(referrer);
        referral.claimReferral();
        vm.expectRevert(abi.encodeWithSelector(IReferralProgram.NothingToClaim.selector, referrer));
        referral.claimReferral();
        vm.stopPrank();
    }

    // --- setRewardBps ---

    function test_SetRewardBps_UpdatesRate() public {
        vm.prank(admin);
        referral.setRewardBps(2_500);
        assertEq(referral.rewardBps(), 2_500);

        vm.prank(referee);
        referral.refer(referrer);
        vm.prank(recorder);
        referral.recordConversion(referee, 1_000e18);
        assertEq(referral.pendingReward(referrer), 250e18);
    }

    function test_SetRewardBps_RevertsTooHigh() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ReferralProgram.InvalidBps.selector, 10_001));
        referral.setRewardBps(10_001);
    }

    function test_SetRewardBps_RevertsUnauthorized() public {
        bytes32 _role = referral.DEFAULT_ADMIN_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, _role
            )
        );
        referral.setRewardBps(500);
    }

    // --- reentrancy (money-movement safety) ---

    function test_ClaimReferral_ReentrancyBlocked() public {
        // Fresh deployment whose reward token is a malicious re-entering ERC20.
        vm.startPrank(admin);
        AddressBook book2 = new AddressBook(admin);
        ReenterERC20 evil = new ReenterERC20();
        book2.setAddress(Keys.GOVERNANCE_TOKEN, address(evil));
        ReferralProgram r2 = new ReferralProgram(address(book2), admin, REWARD_BPS);
        r2.grantRole(r2.CONVERSION_RECORDER_ROLE(), recorder);
        vm.stopPrank();
        evil.mint(address(r2), FUND);

        vm.prank(referee);
        r2.refer(referrer);
        vm.prank(recorder);
        r2.recordConversion(referee, 1_000e18);

        evil.arm(address(r2), abi.encodeWithSelector(r2.claimReferral.selector));
        vm.prank(referrer);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        r2.claimReferral();
    }
}
