// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { ILaborComplianceRegistry } from "../interfaces/ILaborComplianceRegistry.sol";

/// @title LaborComplianceRegistry
/// @notice Tracks labor-standards compliance for employers/sites: social audits, findings/violations and
///         their remediation. An accredited auditor (INSPECTOR_ROLE) opens an audit, records findings at a
///         severity with a remediation deadline, and findings progress through remediation to resolution or
///         waiver. The registry derives a live `standingOf(employer)` used to gate sourcing.
/// @dev Peers resolved via the {AddressBook}. Standing is derived from the employer's currently-open
///      findings: any open Critical => NonCompliant, else any open Major => Watch, otherwise Compliant;
///      Unknown until the employer's first audit. Findings gate is enforced per-auditor.
contract LaborComplianceRegistry is ProofChainAccess, ILaborComplianceRegistry {
    /// @dev Rolling tally of an employer's open findings by severity, plus derived standing cache.
    struct EmployerRecord {
        bool hasAudit;
        uint32 openMinor;
        uint32 openMajor;
        uint32 openCritical;
        ComplianceStanding standing;
    }

    /// @dev auditId => audit header.
    mapping(bytes32 => Audit) private _audits;
    /// @dev findingId => finding record.
    mapping(bytes32 => Finding) private _findings;
    /// @dev employer => aggregated compliance record.
    mapping(address => EmployerRecord) private _employers;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial INSPECTOR_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.INSPECTOR_ROLE, admin);
    }

    /// @inheritdoc ILaborComplianceRegistry
    function openAudit(bytes32 auditId, address employer, bytes32 standard) external onlyRole(Roles.INSPECTOR_ROLE) {
        _requireNotGloballyPaused();
        if (employer == address(0)) revert ZeroEmployer();
        if (_audits[auditId].conductedAt != 0) revert AuditExists(auditId);

        _audits[auditId] = Audit({
            auditId: auditId,
            employer: employer,
            auditor: msg.sender,
            standard: standard,
            conductedAt: uint64(block.timestamp),
            findingCount: 0,
            openCount: 0
        });

        EmployerRecord storage rec = _employers[employer];
        if (!rec.hasAudit) {
            rec.hasAudit = true;
            _recomputeStanding(employer, rec);
        }

        emit AuditOpened(auditId, employer, msg.sender, standard);
    }

    /// @inheritdoc ILaborComplianceRegistry
    function recordFinding(bytes32 auditId, bytes32 findingId, Severity severity, bytes32 detailsHash, uint64 dueBy)
        external
    {
        _requireNotGloballyPaused();
        Audit storage audit = _requireAudit(auditId);
        if (msg.sender != audit.auditor) revert NotAuditor(auditId);
        if (severity == Severity.None) revert InvalidFindingState(findingId, FindingState.Open, FindingState.None);
        if (_findings[findingId].auditId != bytes32(0)) revert FindingExists(findingId);

        _findings[findingId] = Finding({
            findingId: findingId,
            auditId: auditId,
            severity: severity,
            detailsHash: detailsHash,
            dueBy: dueBy,
            state: FindingState.Open
        });

        audit.findingCount += 1;
        audit.openCount += 1;

        EmployerRecord storage rec = _employers[audit.employer];
        _adjustOpenTally(rec, severity, true);
        _recomputeStanding(audit.employer, rec);

        emit FindingRecorded(auditId, findingId, severity, dueBy);
    }

    /// @inheritdoc ILaborComplianceRegistry
    function startRemediation(bytes32 findingId) external {
        _requireNotGloballyPaused();
        Finding storage finding = _requireFinding(findingId);
        Audit storage audit = _audits[finding.auditId];
        if (msg.sender != audit.employer && msg.sender != audit.auditor) revert NotAuditor(finding.auditId);
        if (finding.state != FindingState.Open) {
            revert InvalidFindingState(findingId, FindingState.Open, finding.state);
        }

        finding.state = FindingState.Remediating;
        emit FindingStateChanged(findingId, FindingState.Remediating);
    }

    /// @inheritdoc ILaborComplianceRegistry
    function resolveFinding(bytes32 findingId) external {
        _closeFinding(findingId, FindingState.Resolved, false);
    }

    /// @inheritdoc ILaborComplianceRegistry
    /// @dev `reason` is retained in the ABI for off-chain indexing/audit context; standing derives purely
    ///      from the finding's severity leaving the open set.
    function waiveFinding(bytes32 findingId, bytes32) external onlyRole(Roles.INSPECTOR_ROLE) {
        _closeFinding(findingId, FindingState.Waived, true);
    }

    /// @inheritdoc ILaborComplianceRegistry
    function standingOf(address employer) external view returns (ComplianceStanding) {
        return _employers[employer].standing;
    }

    /// @inheritdoc ILaborComplianceRegistry
    function auditOf(bytes32 auditId) external view returns (Audit memory) {
        return _audits[auditId];
    }

    /// @inheritdoc ILaborComplianceRegistry
    function findingOf(bytes32 findingId) external view returns (Finding memory) {
        return _findings[findingId];
    }

    /// @dev Shared close path for resolve/waive: an open (Open/Remediating) finding is closed, its severity
    ///      is removed from the employer's open tally and standing is recomputed.
    /// @param inspectorOnly When true only INSPECTOR_ROLE may act (waive); otherwise the audit's auditor or
    ///        an INSPECTOR may act (resolve).
    function _closeFinding(bytes32 findingId, FindingState target, bool inspectorOnly) private {
        _requireNotGloballyPaused();
        Finding storage finding = _requireFinding(findingId);
        Audit storage audit = _audits[finding.auditId];

        if (inspectorOnly) {
            _checkRole(Roles.INSPECTOR_ROLE);
        } else if (msg.sender != audit.auditor && !hasRole(Roles.INSPECTOR_ROLE, msg.sender)) {
            revert NotAuditor(finding.auditId);
        }

        if (finding.state != FindingState.Open && finding.state != FindingState.Remediating) {
            revert InvalidFindingState(findingId, FindingState.Remediating, finding.state);
        }

        finding.state = target;
        audit.openCount -= 1;

        EmployerRecord storage rec = _employers[audit.employer];
        _adjustOpenTally(rec, finding.severity, false);
        _recomputeStanding(audit.employer, rec);

        emit FindingStateChanged(findingId, target);
    }

    /// @dev Increment/decrement the employer's open-finding tally for a severity bucket.
    function _adjustOpenTally(EmployerRecord storage rec, Severity severity, bool increment) private {
        if (severity == Severity.Critical) {
            rec.openCritical = increment ? rec.openCritical + 1 : rec.openCritical - 1;
        } else if (severity == Severity.Major) {
            rec.openMajor = increment ? rec.openMajor + 1 : rec.openMajor - 1;
        } else if (severity == Severity.Minor) {
            rec.openMinor = increment ? rec.openMinor + 1 : rec.openMinor - 1;
        }
    }

    /// @dev Recompute and cache the derived standing, emitting {StandingChanged} on any transition.
    function _recomputeStanding(address employer, EmployerRecord storage rec) private {
        ComplianceStanding next;
        if (!rec.hasAudit) {
            next = ComplianceStanding.Unknown;
        } else if (rec.openCritical > 0) {
            next = ComplianceStanding.NonCompliant;
        } else if (rec.openMajor > 0) {
            next = ComplianceStanding.Watch;
        } else {
            next = ComplianceStanding.Compliant;
        }

        if (next != rec.standing) {
            rec.standing = next;
            emit StandingChanged(employer, next);
        }
    }

    /// @dev Fetch an audit by id or revert {UnknownAudit}.
    function _requireAudit(bytes32 auditId) private view returns (Audit storage audit) {
        audit = _audits[auditId];
        if (audit.conductedAt == 0) revert UnknownAudit(auditId);
    }

    /// @dev Fetch a finding by id or revert {UnknownFinding}.
    function _requireFinding(bytes32 findingId) private view returns (Finding storage finding) {
        finding = _findings[findingId];
        if (finding.auditId == bytes32(0)) revert UnknownFinding(findingId);
    }
}
