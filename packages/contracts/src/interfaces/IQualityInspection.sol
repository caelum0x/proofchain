// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IQualityInspection
/// @notice Records physical quality inspections of batches/lots. An accredited inspector opens an inspection
///         against a checklist standard, records a pass/fail outcome with a defect score and evidence, and the
///         result gates downstream actions (acceptance, financing, DPP completeness).
/// @dev deps (AddressBook): ProvenanceRegistry, AttestationRegistry, GradingRegistry, LabTestAttestation.
interface IQualityInspection {
    enum Outcome {
        Pending,
        Passed,
        Failed,
        Conditional
    }

    struct Inspection {
        bytes32 inspectionId;
        bytes32 lotId;
        address inspector;
        bytes32 standard;
        Outcome outcome;
        uint16 defectPpm;
        bytes32 evidenceHash;
        uint64 inspectedAt;
        bool revoked;
    }

    event InspectionOpened(bytes32 indexed inspectionId, bytes32 indexed lotId, address indexed inspector, bytes32 standard);
    event InspectionRecorded(bytes32 indexed inspectionId, Outcome outcome, uint16 defectPpm, bytes32 evidenceHash);
    event InspectionRevoked(bytes32 indexed inspectionId, bytes32 reason);

    error InspectionExists(bytes32 inspectionId);
    error UnknownInspection(bytes32 inspectionId);
    error NotInspector(bytes32 inspectionId);
    error AlreadyRecorded(bytes32 inspectionId);
    error AlreadyRevoked(bytes32 inspectionId);
    error ZeroLot();

    /// @notice Open an inspection against a quality standard. INSPECTOR_ROLE only.
    function openInspection(bytes32 inspectionId, bytes32 lotId, bytes32 standard) external;

    /// @notice Record the inspection outcome with a defect rate (ppm) and evidence hash. Assigned inspector only.
    function recordOutcome(bytes32 inspectionId, Outcome outcome, uint16 defectPpm, bytes32 evidenceHash) external;

    /// @notice Revoke an inspection (error/fraud). Inspector / INSPECTOR_ROLE admin.
    function revoke(bytes32 inspectionId, bytes32 reason) external;

    /// @notice Latest non-revoked inspection id for a lot (0 if none).
    function latestInspectionOf(bytes32 lotId) external view returns (bytes32);

    /// @notice True if the lot's latest inspection passed (or conditional).
    function isPassing(bytes32 lotId) external view returns (bool);

    function inspectionOf(bytes32 inspectionId) external view returns (Inspection memory);
}
