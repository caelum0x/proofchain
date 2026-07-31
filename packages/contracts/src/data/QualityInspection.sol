// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { IQualityInspection } from "../interfaces/IQualityInspection.sol";

/// @title QualityInspection
/// @notice Records physical quality inspections of batches/lots. An accredited inspector opens an
///         inspection against a named checklist standard, then records a pass/fail/conditional outcome
///         carrying a defect rate (ppm) and an evidence hash. The latest non-revoked result for a lot
///         gates downstream actions (acceptance, financing, DPP completeness) via {isPassing}.
/// @dev Inspections are append-only per lot; a mistaken/fraudulent record is revoked (never mutated),
///      after which {latestInspectionOf} falls back to the previous still-valid inspection. Peers read
///      this registry through {IQualityInspection} resolved via the {AddressBook}.
contract QualityInspection is ProofChainAccess, IQualityInspection {
    /// @dev inspectionId => inspection record.
    mapping(bytes32 => Inspection) private _inspections;

    /// @dev lotId => ordered list of inspectionIds recorded for the lot (oldest first).
    mapping(bytes32 => bytes32[]) private _lotInspections;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IQualityInspection
    function openInspection(bytes32 inspectionId, bytes32 lotId, bytes32 standard)
        external
        override
        onlyRole(Roles.INSPECTOR_ROLE)
    {
        _requireNotGloballyPaused();
        if (lotId == bytes32(0)) revert ZeroLot();
        if (_inspections[inspectionId].inspectionId != bytes32(0)) revert InspectionExists(inspectionId);

        _inspections[inspectionId] = Inspection({
            inspectionId: inspectionId,
            lotId: lotId,
            inspector: msg.sender,
            standard: standard,
            outcome: Outcome.Pending,
            defectPpm: 0,
            evidenceHash: bytes32(0),
            inspectedAt: 0,
            revoked: false
        });
        _lotInspections[lotId].push(inspectionId);

        emit InspectionOpened(inspectionId, lotId, msg.sender, standard);
    }

    /// @inheritdoc IQualityInspection
    function recordOutcome(bytes32 inspectionId, Outcome outcome, uint16 defectPpm, bytes32 evidenceHash)
        external
        override
    {
        _requireNotGloballyPaused();
        Inspection storage insp = _inspections[inspectionId];
        if (insp.inspectionId == bytes32(0)) revert UnknownInspection(inspectionId);
        if (msg.sender != insp.inspector) revert NotInspector(inspectionId);
        if (insp.revoked) revert AlreadyRevoked(inspectionId);
        if (insp.outcome != Outcome.Pending) revert AlreadyRecorded(inspectionId);

        insp.outcome = outcome;
        insp.defectPpm = defectPpm;
        insp.evidenceHash = evidenceHash;
        insp.inspectedAt = uint64(block.timestamp);

        emit InspectionRecorded(inspectionId, outcome, defectPpm, evidenceHash);
    }

    /// @inheritdoc IQualityInspection
    function revoke(bytes32 inspectionId, bytes32 reason) external override {
        _requireNotGloballyPaused();
        Inspection storage insp = _inspections[inspectionId];
        if (insp.inspectionId == bytes32(0)) revert UnknownInspection(inspectionId);
        if (msg.sender != insp.inspector && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotInspector(inspectionId);
        }
        if (insp.revoked) revert AlreadyRevoked(inspectionId);

        insp.revoked = true;
        emit InspectionRevoked(inspectionId, reason);
    }

    /// @inheritdoc IQualityInspection
    function latestInspectionOf(bytes32 lotId) public view override returns (bytes32) {
        bytes32[] storage ids = _lotInspections[lotId];
        for (uint256 i = ids.length; i > 0;) {
            unchecked {
                --i;
            }
            if (!_inspections[ids[i]].revoked) return ids[i];
        }
        return bytes32(0);
    }

    /// @inheritdoc IQualityInspection
    function isPassing(bytes32 lotId) external view override returns (bool) {
        bytes32 latest = latestInspectionOf(lotId);
        if (latest == bytes32(0)) return false;
        Outcome outcome = _inspections[latest].outcome;
        return outcome == Outcome.Passed || outcome == Outcome.Conditional;
    }

    /// @inheritdoc IQualityInspection
    function inspectionOf(bytes32 inspectionId) external view override returns (Inspection memory) {
        return _inspections[inspectionId];
    }

    /// @notice Number of inspections ever opened for a lot (including revoked ones).
    function inspectionCountOf(bytes32 lotId) external view returns (uint256) {
        return _lotInspections[lotId].length;
    }
}
