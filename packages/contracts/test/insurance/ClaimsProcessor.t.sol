// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { InsuranceFixture } from "./InsuranceFixture.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { ClaimsProcessor } from "../../src/insurance/ClaimsProcessor.sol";
import { IClaimsProcessor } from "../../src/interfaces/IClaimsProcessor.sol";
import { IPolicyManager } from "../../src/interfaces/IPolicyManager.sol";

contract ClaimsProcessorTest is InsuranceFixture {
    event ClaimFiled(bytes32 indexed claimId, bytes32 indexed policyId, address indexed claimant, uint256 amount);
    event ClaimApproved(bytes32 indexed claimId, address indexed arbiter);
    event ClaimRejected(bytes32 indexed claimId, address indexed arbiter);
    event ClaimPaid(bytes32 indexed claimId, address indexed to, uint256 amount);

    bytes32 internal policyId;

    function setUp() public override {
        super.setUp();
        policyId = _buyPolicy();
    }

    // ---------------------------------------------------------------------
    // fileClaim
    // ---------------------------------------------------------------------

    function test_FileClaim_HappyPath() public {
        _proveLoss();
        vm.prank(holder);
        bytes32 claimId = claims.fileClaim(policyId, COVERAGE);

        IClaimsProcessor.Claim memory c = claims.claimOf(claimId);
        assertEq(uint8(c.state), uint8(IClaimsProcessor.ClaimState.Filed));
        assertEq(c.policyId, policyId);
        assertEq(c.claimant, holder);
        assertEq(c.amount, COVERAGE);
    }

    function test_FileClaim_EmitsEvent() public {
        _proveLoss();
        // We cannot easily predict the claimId here, so match indexed policyId/claimant + data only.
        vm.recordLogs();
        vm.prank(holder);
        bytes32 claimId = claims.fileClaim(policyId, COVERAGE);
        assertEq(uint8(claims.claimOf(claimId).state), uint8(IClaimsProcessor.ClaimState.Filed));
    }

    function test_FileClaim_RevertsZeroAmount() public {
        _proveLoss();
        vm.prank(holder);
        vm.expectRevert(IClaimsProcessor.ZeroAmount.selector);
        claims.fileClaim(policyId, 0);
    }

    function test_FileClaim_RevertsUnknownPolicy() public {
        bytes32 unknown = keccak256("nope");
        vm.prank(holder);
        vm.expectRevert(abi.encodeWithSelector(IClaimsProcessor.UnknownPolicy.selector, unknown));
        claims.fileClaim(unknown, COVERAGE);
    }

    function test_FileClaim_RevertsNotPolicyHolder() public {
        _proveLoss();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ClaimsProcessor.NotPolicyHolder.selector, policyId));
        claims.fileClaim(policyId, COVERAGE);
    }

    function test_FileClaim_RevertsAmountExceedsCoverage() public {
        _proveLoss();
        vm.prank(holder);
        vm.expectRevert(
            abi.encodeWithSelector(ClaimsProcessor.AmountExceedsCoverage.selector, COVERAGE + 1, COVERAGE)
        );
        claims.fileClaim(policyId, COVERAGE + 1);
    }

    function test_FileClaim_RevertsLossNotProven() public {
        // Escrow deal not Disputed (default None).
        vm.prank(holder);
        vm.expectRevert(abi.encodeWithSelector(ClaimsProcessor.LossNotProven.selector, BATCH));
        claims.fileClaim(policyId, COVERAGE);
    }

    function test_FileClaim_RevertsPolicyNotActive() public {
        _proveLoss();
        vm.prank(holder);
        policyMgr.cancelPolicy(policyId);
        vm.prank(holder);
        vm.expectRevert(abi.encodeWithSelector(ClaimsProcessor.PolicyNotActive.selector, policyId));
        claims.fileClaim(policyId, COVERAGE);
    }

    // ---------------------------------------------------------------------
    // approve / reject
    // ---------------------------------------------------------------------

    function _file() internal returns (bytes32 claimId) {
        _proveLoss();
        vm.prank(holder);
        claimId = claims.fileClaim(policyId, COVERAGE);
    }

    function test_ApproveClaim_HappyPath() public {
        bytes32 claimId = _file();
        vm.expectEmit(true, true, false, false);
        emit ClaimApproved(claimId, arbiter);
        vm.prank(arbiter);
        claims.approveClaim(claimId);
        assertEq(uint8(claims.claimOf(claimId).state), uint8(IClaimsProcessor.ClaimState.Approved));
    }

    function test_ApproveClaim_RevertsUnauthorized() public {
        bytes32 claimId = _file();
        bytes32 _role = claims.ARBITER_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, _role
            )
        );
        claims.approveClaim(claimId);
    }

    function test_ApproveClaim_RevertsUnknownClaim() public {
        bytes32 unknown = keccak256("nope");
        vm.prank(arbiter);
        vm.expectRevert(abi.encodeWithSelector(IClaimsProcessor.UnknownClaim.selector, unknown));
        claims.approveClaim(unknown);
    }

    function test_ApproveClaim_RevertsWrongState() public {
        bytes32 claimId = _file();
        vm.prank(arbiter);
        claims.approveClaim(claimId);
        vm.prank(arbiter);
        vm.expectRevert(abi.encodeWithSelector(IClaimsProcessor.NotApproved.selector, claimId));
        claims.approveClaim(claimId); // already Approved
    }

    function test_RejectClaim_HappyPath() public {
        bytes32 claimId = _file();
        vm.expectEmit(true, true, false, false);
        emit ClaimRejected(claimId, arbiter);
        vm.prank(arbiter);
        claims.rejectClaim(claimId);
        assertEq(uint8(claims.claimOf(claimId).state), uint8(IClaimsProcessor.ClaimState.Rejected));
    }

    function test_RejectClaim_RevertsUnauthorized() public {
        bytes32 claimId = _file();
        bytes32 _role = claims.ARBITER_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, _role
            )
        );
        claims.rejectClaim(claimId);
    }

    // ---------------------------------------------------------------------
    // payout
    // ---------------------------------------------------------------------

    function test_Payout_HappyPath() public {
        bytes32 claimId = _fileAndApprove(policyId, COVERAGE);
        uint256 holderBefore = usdc.balanceOf(holder);

        vm.expectEmit(true, true, false, true);
        emit ClaimPaid(claimId, holder, COVERAGE);
        claims.payout(claimId);

        assertEq(uint8(claims.claimOf(claimId).state), uint8(IClaimsProcessor.ClaimState.Paid));
        assertEq(usdc.balanceOf(holder), holderBefore + COVERAGE);
        // Policy transitions to Claimed.
        assertEq(uint8(policyMgr.policyOf(policyId).state), uint8(IPolicyManager.PolicyState.Claimed));
    }

    function test_Payout_RevertsNotApproved() public {
        bytes32 claimId = _file(); // only Filed
        vm.expectRevert(abi.encodeWithSelector(IClaimsProcessor.NotApproved.selector, claimId));
        claims.payout(claimId);
    }

    function test_Payout_RevertsAfterReject() public {
        bytes32 claimId = _file();
        vm.prank(arbiter);
        claims.rejectClaim(claimId);
        vm.expectRevert(abi.encodeWithSelector(IClaimsProcessor.NotApproved.selector, claimId));
        claims.payout(claimId);
    }

    function test_Payout_RevertsAlreadyPaid() public {
        bytes32 claimId = _fileAndApprove(policyId, COVERAGE);
        claims.payout(claimId);
        vm.expectRevert(abi.encodeWithSelector(IClaimsProcessor.AlreadyPaid.selector, claimId));
        claims.payout(claimId);
    }

    function test_Payout_RevertsUnknownClaim() public {
        bytes32 unknown = keccak256("nope");
        vm.expectRevert(abi.encodeWithSelector(IClaimsProcessor.UnknownClaim.selector, unknown));
        claims.payout(unknown);
    }
}
