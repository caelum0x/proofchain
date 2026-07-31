// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IMilestonePayroll
/// @notice Stablecoin payroll where a worker is paid per delivery milestone. An employer funds an agreement,
///         defines milestones with amounts, and releases each milestone's payment when approved (optionally
///         gated by an AI verification / delivery attestation). Unreleased funds can be reclaimed on cancel.
/// @dev deps (AddressBook): StablecoinRegistry, WorkerCredential, AttestationRegistry, SettlementEscrow.
///      SafeERC20 + nonReentrant on all fund movement.
interface IMilestonePayroll {
    enum AgreementState {
        None,
        Funded,
        Active,
        Completed,
        Cancelled
    }

    enum MilestoneState {
        Pending,
        Approved,
        Released,
        Cancelled
    }

    struct Agreement {
        bytes32 agreementId;
        address employer;
        address worker;
        address token;
        uint256 totalAmount;
        uint256 releasedAmount;
        uint16 milestoneCount;
        uint16 releasedCount;
        AgreementState state;
    }

    struct Milestone {
        bytes32 descriptionHash;
        uint256 amount;
        bytes32 attestationId;
        MilestoneState state;
    }

    event AgreementCreated(bytes32 indexed agreementId, address indexed employer, address indexed worker, address token, uint256 totalAmount);
    event MilestoneAdded(bytes32 indexed agreementId, uint16 indexed index, uint256 amount, bytes32 descriptionHash);
    event MilestoneApproved(bytes32 indexed agreementId, uint16 indexed index, bytes32 attestationId);
    event MilestoneReleased(bytes32 indexed agreementId, uint16 indexed index, address indexed worker, uint256 amount);
    event AgreementCompleted(bytes32 indexed agreementId);
    event AgreementCancelled(bytes32 indexed agreementId, uint256 refunded);

    error AgreementExists(bytes32 agreementId);
    error UnknownAgreement(bytes32 agreementId);
    error InvalidState(bytes32 agreementId, AgreementState expected, AgreementState actual);
    error NotEmployer(bytes32 agreementId);
    error IndexOutOfRange(bytes32 agreementId, uint16 index);
    error InvalidMilestoneState(bytes32 agreementId, uint16 index, MilestoneState expected, MilestoneState actual);
    error MilestoneSumMismatch(uint256 expected, uint256 provided);
    error ZeroAmount();

    /// @notice Create and fund a payroll agreement, pulling `totalAmount` of stablecoin. nonReentrant.
    function createAgreement(
        bytes32 agreementId,
        address worker,
        address token,
        uint256 totalAmount,
        uint256[] calldata milestoneAmounts,
        bytes32[] calldata descriptionHashes
    ) external;

    /// @notice Approve a milestone (optionally referencing a delivery attestation). Employer / AGENT_ROLE.
    function approveMilestone(bytes32 agreementId, uint16 index, bytes32 attestationId) external;

    /// @notice Release an approved milestone's payment to the worker. nonReentrant.
    function releaseMilestone(bytes32 agreementId, uint16 index) external;

    /// @notice Cancel the agreement, refunding unreleased funds to the employer. nonReentrant.
    function cancel(bytes32 agreementId) external;

    /// @notice Total funds still held for unreleased milestones.
    function unreleasedBalance(bytes32 agreementId) external view returns (uint256);

    function agreementOf(bytes32 agreementId) external view returns (Agreement memory);
    function milestoneAt(bytes32 agreementId, uint16 index) external view returns (Milestone memory);
}
