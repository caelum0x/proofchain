// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { InsuranceFixture } from "./InsuranceFixture.sol";
import { MockUSDC } from "../../src/MockUSDC.sol";
import { PolicyManager } from "../../src/insurance/PolicyManager.sol";
import { IPolicyManager } from "../../src/interfaces/IPolicyManager.sol";

contract PolicyManagerTest is InsuranceFixture {
    event PolicyIssued(
        bytes32 indexed policyId, bytes32 indexed batchId, address indexed holder, uint256 coverage, uint256 premium
    );
    event PolicyCancelled(bytes32 indexed policyId);

    function _predictPolicyId(address who, uint256 coverage, uint256 nonce) internal pure returns (bytes32) {
        return keccak256(abi.encode("Policy", BATCH, who, coverage, nonce));
    }

    // ---------------------------------------------------------------------
    // buyPolicy
    // ---------------------------------------------------------------------

    function test_BuyPolicy_HappyPath() public {
        uint256 expectedPremium = _expectedPremium(COVERAGE, SUPPLIER_GRADE);
        bytes32 expectedId = _predictPolicyId(holder, COVERAGE, 0);
        uint256 holderBefore = usdc.balanceOf(holder);

        vm.expectEmit(true, true, true, true);
        emit PolicyIssued(expectedId, BATCH, holder, COVERAGE, expectedPremium);
        vm.prank(holder);
        bytes32 policyId = policyMgr.buyPolicy(BATCH, address(usdc), COVERAGE);

        assertEq(policyId, expectedId);
        assertEq(policyMgr.policyForBatch(BATCH), policyId);

        IPolicyManager.Policy memory p = policyMgr.policyOf(policyId);
        assertEq(uint8(p.state), uint8(IPolicyManager.PolicyState.Active));
        assertEq(p.holder, holder);
        assertEq(p.batchId, BATCH);
        assertEq(p.token, address(usdc));
        assertEq(p.coverage, COVERAGE);
        assertEq(p.premium, expectedPremium);

        // Premium left the holder and became pool capital; coverage reserved.
        assertEq(usdc.balanceOf(holder), holderBefore - expectedPremium);
        assertEq(pool.reservedCapital(), COVERAGE);
        assertEq(pool.totalCapital(address(usdc)), LP_CAPITAL + expectedPremium);
    }

    function test_BuyPolicy_RevertsZeroCoverage() public {
        vm.prank(holder);
        vm.expectRevert(IPolicyManager.ZeroCoverage.selector);
        policyMgr.buyPolicy(BATCH, address(usdc), 0);
    }

    function test_BuyPolicy_RevertsTokenNotAccepted() public {
        MockUSDC other = new MockUSDC();
        vm.prank(holder);
        vm.expectRevert(abi.encodeWithSelector(PolicyManager.TokenNotAccepted.selector, address(other)));
        policyMgr.buyPolicy(BATCH, address(other), COVERAGE);
    }

    function test_BuyPolicy_RevertsZeroTokenAddress() public {
        vm.prank(holder);
        vm.expectRevert(abi.encodeWithSelector(PolicyManager.TokenNotAccepted.selector, address(0)));
        policyMgr.buyPolicy(BATCH, address(0), COVERAGE);
    }

    function test_BuyPolicy_RevertsPolicyExists() public {
        bytes32 policyId = _buyPolicy();
        usdc.mint(holder, 1_000e6);
        vm.prank(holder);
        vm.expectRevert(abi.encodeWithSelector(IPolicyManager.PolicyExists.selector, policyId));
        policyMgr.buyPolicy(BATCH, address(usdc), COVERAGE);
    }

    function test_BuyPolicy_ReBuyAfterCancel() public {
        bytes32 first = _buyPolicy();
        vm.prank(holder);
        policyMgr.cancelPolicy(first);

        usdc.mint(holder, 1_000e6);
        vm.prank(holder);
        bytes32 second = policyMgr.buyPolicy(BATCH, address(usdc), COVERAGE);

        assertTrue(second != first);
        assertEq(policyMgr.policyForBatch(BATCH), second);
    }

    function test_BuyPolicy_UngradedSupplierUsesDefaultGrade() public {
        oracle.setGrade(supplier, 0); // ungraded
        uint256 expected = _expectedPremium(COVERAGE, policyMgr.DEFAULT_GRADE());
        assertEq(policyMgr.quote(BATCH, COVERAGE), expected);

        vm.prank(holder);
        bytes32 policyId = policyMgr.buyPolicy(BATCH, address(usdc), COVERAGE);
        assertEq(policyMgr.policyOf(policyId).premium, expected);
    }

    function test_BuyPolicy_GradePricingChangesPremium() public {
        oracle.setGrade(supplier, 7); // worst grade -> highest premium
        uint256 expected = _expectedPremium(COVERAGE, 7);
        assertEq(policyMgr.quote(BATCH, COVERAGE), expected);
        assertGt(expected, _expectedPremium(COVERAGE, SUPPLIER_GRADE));
    }

    // ---------------------------------------------------------------------
    // cancelPolicy
    // ---------------------------------------------------------------------

    function test_CancelPolicy_HappyPath() public {
        bytes32 policyId = _buyPolicy();
        vm.expectEmit(true, false, false, false);
        emit PolicyCancelled(policyId);
        vm.prank(holder);
        policyMgr.cancelPolicy(policyId);

        assertEq(uint8(policyMgr.policyOf(policyId).state), uint8(IPolicyManager.PolicyState.Cancelled));
        assertEq(policyMgr.policyForBatch(BATCH), bytes32(0));
    }

    function test_CancelPolicy_RevertsNotHolder() public {
        bytes32 policyId = _buyPolicy();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IPolicyManager.NotHolder.selector, policyId));
        policyMgr.cancelPolicy(policyId);
    }

    function test_CancelPolicy_RevertsUnknownPolicy() public {
        bytes32 unknown = keccak256("nope");
        vm.prank(holder);
        vm.expectRevert(abi.encodeWithSelector(IPolicyManager.UnknownPolicy.selector, unknown));
        policyMgr.cancelPolicy(unknown);
    }

    function test_CancelPolicy_RevertsWhenAlreadyCancelled() public {
        bytes32 policyId = _buyPolicy();
        vm.startPrank(holder);
        policyMgr.cancelPolicy(policyId);
        vm.expectRevert(abi.encodeWithSelector(IPolicyManager.UnknownPolicy.selector, policyId));
        policyMgr.cancelPolicy(policyId);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------------
    // markClaimed (access)
    // ---------------------------------------------------------------------

    function test_MarkClaimed_RevertsNonClaimsProcessor() public {
        bytes32 policyId = _buyPolicy();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IPolicyManager.NotHolder.selector, policyId));
        policyMgr.markClaimed(policyId);
    }
}
