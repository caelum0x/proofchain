// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { IProductRecallRegistry } from "../interfaces/IProductRecallRegistry.sol";
import { IProvenanceRegistry } from "../interfaces/IProvenanceRegistry.sol";

/// @title ProductRecallRegistry
/// @notice Public register of product recalls tied to batches. A manufacturer (REGISTRAR_ROLE) or a
///         regulator (COMPLIANCE_OFFICER_ROLE) opens a recall with a severity class and affected-unit
///         count; remediation is tracked until the recall is resolved or cancelled.
/// @dev Peers resolved via the {AddressBook}. `isRecalled(batchId)` reflects whether any Open/Escalated
///      recall covers the batch, so DPP/marketplace peers can hard-stop distribution.
contract ProductRecallRegistry is ProofChainAccess, IProductRecallRegistry {
    mapping(bytes32 => Recall) private _recalls;
    /// @dev Count of currently Open/Escalated recalls per batch.
    mapping(bytes32 => uint256) private _activeByBatch;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE, REGISTRAR_ROLE and COMPLIANCE_OFFICER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.REGISTRAR_ROLE, admin);
        _grantRole(Roles.COMPLIANCE_OFFICER_ROLE, admin);
    }

    /// @inheritdoc IProductRecallRegistry
    function openRecall(
        bytes32 recallId,
        bytes32 batchId,
        Severity severity,
        bytes32 reasonHash,
        uint256 affectedUnits
    ) external {
        _requireNotGloballyPaused();
        _requireRecaller();
        if (_recalls[recallId].openedAt != 0) revert RecallExists(recallId);
        if (affectedUnits == 0) revert ZeroUnits();
        _requireBatch(batchId);

        _recalls[recallId] = Recall({
            recallId: recallId,
            batchId: batchId,
            initiator: msg.sender,
            severity: severity,
            reasonHash: reasonHash,
            affectedUnits: affectedUnits,
            remediatedUnits: 0,
            openedAt: uint64(block.timestamp),
            state: RecallState.Open
        });
        _activeByBatch[batchId] += 1;

        emit RecallOpened(recallId, batchId, msg.sender, severity, affectedUnits);
    }

    /// @inheritdoc IProductRecallRegistry
    function escalate(bytes32 recallId, Severity newSeverity) external {
        _requireNotGloballyPaused();
        Recall storage recall = _recallOpenOrEscalated(recallId);
        if (msg.sender != recall.initiator) revert NotInitiator(recallId);

        recall.severity = newSeverity;
        recall.state = RecallState.Escalated;
        emit RecallEscalated(recallId, newSeverity);
    }

    /// @inheritdoc IProductRecallRegistry
    function recordRemediation(bytes32 recallId, uint256 units) external {
        _requireNotGloballyPaused();
        Recall storage recall = _recallOpenOrEscalated(recallId);
        if (units == 0) revert ZeroUnits();

        uint256 total = recall.remediatedUnits + units;
        if (total > recall.affectedUnits) revert ExceedsAffected(total, recall.affectedUnits);

        recall.remediatedUnits = total;
        emit UnitsRemediated(recallId, units, total);
    }

    /// @inheritdoc IProductRecallRegistry
    function resolve(bytes32 recallId) external {
        _requireNotGloballyPaused();
        Recall storage recall = _recallOpenOrEscalated(recallId);

        recall.state = RecallState.Resolved;
        _decActive(recall.batchId);
        emit RecallResolved(recallId);
    }

    /// @inheritdoc IProductRecallRegistry
    function cancel(bytes32 recallId) external {
        _requireNotGloballyPaused();
        Recall storage recall = _recallOpenOrEscalated(recallId);
        if (msg.sender != recall.initiator) revert NotInitiator(recallId);

        recall.state = RecallState.Cancelled;
        _decActive(recall.batchId);
        emit RecallCancelled(recallId);
    }

    /// @inheritdoc IProductRecallRegistry
    function isRecalled(bytes32 batchId) external view returns (bool) {
        return _activeByBatch[batchId] > 0;
    }

    /// @inheritdoc IProductRecallRegistry
    function recallOf(bytes32 recallId) external view returns (Recall memory) {
        return _recalls[recallId];
    }

    // --------------------------------------------------------------------- internal

    /// @dev Load a recall and require it to be Open or Escalated, else revert appropriately.
    function _recallOpenOrEscalated(bytes32 recallId) internal view returns (Recall storage recall) {
        recall = _recalls[recallId];
        if (recall.openedAt == 0) revert UnknownRecall(recallId);
        if (recall.state != RecallState.Open && recall.state != RecallState.Escalated) {
            revert InvalidState(recallId, RecallState.Open, recall.state);
        }
    }

    /// @dev Decrement the per-batch active counter, guarding against underflow.
    function _decActive(bytes32 batchId) internal {
        if (_activeByBatch[batchId] > 0) _activeByBatch[batchId] -= 1;
    }

    /// @dev Caller must hold REGISTRAR_ROLE or COMPLIANCE_OFFICER_ROLE.
    function _requireRecaller() internal view {
        if (!hasRole(Roles.REGISTRAR_ROLE, msg.sender) && !hasRole(Roles.COMPLIANCE_OFFICER_ROLE, msg.sender)) {
            revert IAccessControl.AccessControlUnauthorizedAccount(msg.sender, Roles.COMPLIANCE_OFFICER_ROLE);
        }
    }

    /// @dev Require the batch to exist in provenance ground-truth when that peer is wired.
    function _requireBatch(bytes32 batchId) internal view {
        address prov = _addrOrZero(Keys.PROVENANCE_REGISTRY);
        if (prov != address(0) && !IProvenanceRegistry(prov).batchExists(batchId)) {
            revert IProvenanceRegistry.UnknownBatch(batchId);
        }
    }
}
