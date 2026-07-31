// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IPolicyManager } from "../../../src/interfaces/IPolicyManager.sol";

/// @notice Combined test double for the {PolicyManager} reads and {ClaimsProcessor.fileClaim} write
///         that {ColdChainMonitor} touches for its parametric-payout hook. Registered at BOTH the
///         POLICY_MANAGER and CLAIMS_PROCESSOR AddressBook keys.
contract MockParametricInsurance {
    mapping(bytes32 => bytes32) public policyForBatch;
    mapping(bytes32 => IPolicyManager.Policy) private _policies;

    // Records of parametric claims filed via fileClaim.
    bytes32 public lastPolicyId;
    uint256 public lastAmount;
    uint256 public fileCount;
    bool public shouldRevert;

    function setPolicy(bytes32 batchId, bytes32 policyId, uint256 coverage, IPolicyManager.PolicyState state) external {
        policyForBatch[batchId] = policyId;
        _policies[policyId] = IPolicyManager.Policy({
            policyId: policyId,
            batchId: batchId,
            holder: address(0xBEEF),
            token: address(0),
            coverage: coverage,
            premium: 0,
            issuedAt: uint64(block.timestamp),
            state: state
        });
    }

    function setShouldRevert(bool v) external {
        shouldRevert = v;
    }

    function policyOf(bytes32 policyId) external view returns (IPolicyManager.Policy memory) {
        return _policies[policyId];
    }

    /// @notice Mirrors {IClaimsProcessor.fileClaim}; records the call.
    function fileClaim(bytes32 policyId, uint256 amount) external returns (bytes32) {
        require(!shouldRevert, "claims down");
        lastPolicyId = policyId;
        lastAmount = amount;
        fileCount += 1;
        return keccak256(abi.encode(policyId, amount, fileCount));
    }
}
