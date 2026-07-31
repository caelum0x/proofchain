// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IClaimsProcessor
/// @notice Files and pays insurance claims on disputed + proven-loss batches.
/// @dev deps (AddressBook): InsurancePool, PolicyManager, DisputeArbitration.
interface IClaimsProcessor {
    enum ClaimState {
        None,
        Filed,
        Approved,
        Rejected,
        Paid
    }

    struct Claim {
        bytes32 claimId;
        bytes32 policyId;
        address claimant;
        uint256 amount;
        ClaimState state;
        uint64 filedAt;
    }

    event ClaimFiled(bytes32 indexed claimId, bytes32 indexed policyId, address indexed claimant, uint256 amount);
    event ClaimApproved(bytes32 indexed claimId, address indexed arbiter);
    event ClaimRejected(bytes32 indexed claimId, address indexed arbiter);
    event ClaimPaid(bytes32 indexed claimId, address indexed to, uint256 amount);

    error ClaimExists(bytes32 claimId);
    error UnknownClaim(bytes32 claimId);
    error UnknownPolicy(bytes32 policyId);
    error NotApproved(bytes32 claimId);
    error AlreadyPaid(bytes32 claimId);
    error ZeroAmount();

    /// @notice File a claim against a policy for `amount`.
    /// @return claimId Identifier of the filed claim.
    function fileClaim(bytes32 policyId, uint256 amount) external returns (bytes32 claimId);

    /// @notice Approve a filed claim. ARBITER_ROLE only.
    function approveClaim(bytes32 claimId) external;

    /// @notice Reject a filed claim. ARBITER_ROLE only.
    function rejectClaim(bytes32 claimId) external;

    /// @notice Pay an approved claim from the insurance pool.
    function payout(bytes32 claimId) external;

    function claimOf(bytes32 claimId) external view returns (Claim memory);
}
