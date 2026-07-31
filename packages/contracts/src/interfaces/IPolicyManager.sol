// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IPolicyManager
/// @notice Buyers/lenders purchase insurance policies covering a batch.
/// @dev deps (AddressBook): PremiumCalculator, InsurancePool, ScoreOracle.
interface IPolicyManager {
    enum PolicyState {
        None,
        Active,
        Claimed,
        Expired,
        Cancelled
    }

    struct Policy {
        bytes32 policyId;
        bytes32 batchId;
        address holder;
        address token;
        uint256 coverage;
        uint256 premium;
        uint64 issuedAt;
        PolicyState state;
    }

    event PolicyIssued(
        bytes32 indexed policyId, bytes32 indexed batchId, address indexed holder, uint256 coverage, uint256 premium
    );
    event PolicyCancelled(bytes32 indexed policyId);

    error PolicyExists(bytes32 policyId);
    error UnknownPolicy(bytes32 policyId);
    error ZeroCoverage();
    error NotHolder(bytes32 policyId);

    /// @notice Buy a policy covering `coverage` on `batchId`; pulls the computed premium.
    /// @return policyId Identifier of the issued policy.
    function buyPolicy(bytes32 batchId, address token, uint256 coverage) external returns (bytes32 policyId);

    /// @notice Cancel an active policy.
    function cancelPolicy(bytes32 policyId) external;

    /// @notice Mark a policy as Claimed after a claim pays out. ClaimsProcessor only.
    function markClaimed(bytes32 policyId) external;

    function policyOf(bytes32 policyId) external view returns (Policy memory);
    function policyForBatch(bytes32 batchId) external view returns (bytes32);
}
