// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ILaborComplianceRegistry
/// @notice Tracks labor-standards compliance for employers/sites: social audits, findings/violations, and
///         remediation. An auditor opens an audit for an employer, records findings at a severity, and the
///         employer resolves them; the registry derives a current compliance standing used to gate sourcing.
/// @dev deps (AddressBook): OrganizationRegistry, WorkerCredential, SafetyTrainingRegistry, ESGRegistry.
interface ILaborComplianceRegistry {
    enum Severity {
        None,
        Minor,
        Major,
        Critical
    }

    enum FindingState {
        None,
        Open,
        Remediating,
        Resolved,
        Waived
    }

    enum ComplianceStanding {
        Unknown,
        Compliant,
        Watch,
        NonCompliant
    }

    struct Audit {
        bytes32 auditId;
        address employer;
        address auditor;
        bytes32 standard;
        uint64 conductedAt;
        uint16 findingCount;
        uint16 openCount;
    }

    struct Finding {
        bytes32 findingId;
        bytes32 auditId;
        Severity severity;
        bytes32 detailsHash;
        uint64 dueBy;
        FindingState state;
    }

    event AuditOpened(bytes32 indexed auditId, address indexed employer, address indexed auditor, bytes32 standard);
    event FindingRecorded(bytes32 indexed auditId, bytes32 indexed findingId, Severity severity, uint64 dueBy);
    event FindingStateChanged(bytes32 indexed findingId, FindingState state);
    event StandingChanged(address indexed employer, ComplianceStanding standing);

    error AuditExists(bytes32 auditId);
    error UnknownAudit(bytes32 auditId);
    error NotAuditor(bytes32 auditId);
    error FindingExists(bytes32 findingId);
    error UnknownFinding(bytes32 findingId);
    error InvalidFindingState(bytes32 findingId, FindingState expected, FindingState actual);
    error ZeroEmployer();

    /// @notice Open a labor-standards audit for an employer. INSPECTOR_ROLE / accredited auditor.
    function openAudit(bytes32 auditId, address employer, bytes32 standard) external;

    /// @notice Record a finding against an audit at a severity with a remediation deadline. Auditor only.
    function recordFinding(bytes32 auditId, bytes32 findingId, Severity severity, bytes32 detailsHash, uint64 dueBy)
        external;

    /// @notice Mark a finding as under remediation. Employer / auditor.
    function startRemediation(bytes32 findingId) external;

    /// @notice Resolve a finding after verified remediation. Auditor / INSPECTOR_ROLE.
    function resolveFinding(bytes32 findingId) external;

    /// @notice Waive a finding (accepted risk / not applicable). INSPECTOR_ROLE.
    function waiveFinding(bytes32 findingId, bytes32 reason) external;

    /// @notice Current derived compliance standing for an employer.
    function standingOf(address employer) external view returns (ComplianceStanding);

    function auditOf(bytes32 auditId) external view returns (Audit memory);
    function findingOf(bytes32 findingId) external view returns (Finding memory);
}
