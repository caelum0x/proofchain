// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IProductRecallRegistry
/// @notice Public register of product recalls and safety notices tied to batches. A manufacturer or
///         regulator opens a recall with a severity class and scope; affected units are tracked as they
///         are remediated, and the recall is closed when resolved.
/// @dev deps (AddressBook): ProvenanceRegistry, DigitalProductPassport.
interface IProductRecallRegistry {
    enum Severity {
        Advisory,
        Voluntary,
        ClassIII,
        ClassII,
        ClassI
    }

    enum RecallState {
        None,
        Open,
        Escalated,
        Resolved,
        Cancelled
    }

    struct Recall {
        bytes32 recallId;
        bytes32 batchId;
        address initiator;
        Severity severity;
        bytes32 reasonHash;
        uint256 affectedUnits;
        uint256 remediatedUnits;
        uint64 openedAt;
        RecallState state;
    }

    event RecallOpened(bytes32 indexed recallId, bytes32 indexed batchId, address indexed initiator, Severity severity, uint256 affectedUnits);
    event RecallEscalated(bytes32 indexed recallId, Severity newSeverity);
    event UnitsRemediated(bytes32 indexed recallId, uint256 units, uint256 totalRemediated);
    event RecallResolved(bytes32 indexed recallId);
    event RecallCancelled(bytes32 indexed recallId);

    error RecallExists(bytes32 recallId);
    error UnknownRecall(bytes32 recallId);
    error InvalidState(bytes32 recallId, RecallState expected, RecallState actual);
    error NotInitiator(bytes32 recallId);
    error ZeroUnits();
    error ExceedsAffected(uint256 remediated, uint256 affected);

    /// @notice Open a recall for a batch. REGISTRAR_ROLE or COMPLIANCE_OFFICER_ROLE.
    function openRecall(bytes32 recallId, bytes32 batchId, Severity severity, bytes32 reasonHash, uint256 affectedUnits)
        external;

    /// @notice Escalate a recall's severity.
    function escalate(bytes32 recallId, Severity newSeverity) external;

    /// @notice Record remediated (repaired/returned/destroyed) units.
    function recordRemediation(bytes32 recallId, uint256 units) external;

    /// @notice Resolve a recall once remediation is complete.
    function resolve(bytes32 recallId) external;

    /// @notice Cancel a recall opened in error.
    function cancel(bytes32 recallId) external;

    /// @notice True if the batch currently has an open/escalated recall.
    function isRecalled(bytes32 batchId) external view returns (bool);

    function recallOf(bytes32 recallId) external view returns (Recall memory);
}
