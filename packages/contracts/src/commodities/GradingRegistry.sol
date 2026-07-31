// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { Keys } from "../core/Keys.sol";
import { IGradingRegistry } from "../interfaces/IGradingRegistry.sol";
import { IHarvestRegistry } from "../interfaces/IHarvestRegistry.sol";

/// @title GradingRegistry
/// @notice Accredited graders record immutable quality attestations for commodity lots against a named
///         grading standard (USDA, ICO, ...). Each grading carries a numeric score (bps of the standard's
///         max), a grade class, and an evidence hash; graders can revoke a prior grading on discovered
///         error or fraud, after which the lot falls back to its previous non-revoked grading.
/// @dev When a lot is a harvest, recording a grading transitions the lot's state in the {HarvestRegistry}
///      (resolved via the {AddressBook}) — a real cross-domain integration rather than duplicated state.
contract GradingRegistry is ProofChainAccess, IGradingRegistry {
    /// @dev Maximum score, expressed in basis points of the standard's maximum.
    uint16 private constant MAX_SCORE = 10_000;

    /// @dev gradingId => grading record.
    mapping(bytes32 => Grading) private _gradings;

    /// @dev lotId => ordered list of gradingIds recorded for the lot (oldest first).
    mapping(bytes32 => bytes32[]) private _lotGradings;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IGradingRegistry
    function grade(
        bytes32 gradingId,
        bytes32 lotId,
        bytes32 standard,
        bytes32 gradeClass,
        uint16 score,
        bytes32 evidenceHash
    ) external override onlyRole(Roles.GRADER_ROLE) {
        _requireNotGloballyPaused();
        if (lotId == bytes32(0)) revert ZeroLot();
        if (score > MAX_SCORE) revert ScoreOutOfRange(score);
        if (_gradings[gradingId].gradingId != bytes32(0)) revert GradingExists(gradingId);

        _gradings[gradingId] = Grading({
            gradingId: gradingId,
            lotId: lotId,
            standard: standard,
            grade: gradeClass,
            score: score,
            grader: msg.sender,
            evidenceHash: evidenceHash,
            gradedAt: uint64(block.timestamp),
            revoked: false
        });
        _lotGradings[lotId].push(gradingId);

        emit Graded(gradingId, lotId, standard, gradeClass, score, msg.sender);

        _syncHarvestGraded(lotId, gradeClass);
    }

    /// @inheritdoc IGradingRegistry
    function revoke(bytes32 gradingId, bytes32 reason) external override {
        _requireNotGloballyPaused();
        Grading storage g = _gradings[gradingId];
        if (g.gradingId == bytes32(0)) revert UnknownGrading(gradingId);
        if (g.revoked) revert AlreadyRevoked(gradingId);
        if (msg.sender != g.grader && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert NotGrader(gradingId);

        g.revoked = true;
        emit GradingRevoked(gradingId, reason);
    }

    /// @inheritdoc IGradingRegistry
    function latestGradingOf(bytes32 lotId) external view override returns (bytes32) {
        bytes32[] storage ids = _lotGradings[lotId];
        for (uint256 i = ids.length; i > 0;) {
            unchecked {
                --i;
            }
            if (!_gradings[ids[i]].revoked) return ids[i];
        }
        return bytes32(0);
    }

    /// @inheritdoc IGradingRegistry
    function gradingOf(bytes32 gradingId) external view override returns (Grading memory) {
        return _gradings[gradingId];
    }

    /// @notice Number of gradings ever recorded for a lot (including revoked ones).
    function gradingCountOf(bytes32 lotId) external view returns (uint256) {
        return _lotGradings[lotId].length;
    }

    /// @dev If the lot is a Registered harvest, advance it to Graded in the {HarvestRegistry}. Best-effort:
    ///      a non-harvest lot (or one past the Registered state) simply leaves the harvest side untouched.
    function _syncHarvestGraded(bytes32 lotId, bytes32 gradeClass) private {
        address hr = _addrOrZero(Keys.HARVEST_REGISTRY);
        if (hr == address(0)) return;

        IHarvestRegistry registry = IHarvestRegistry(hr);
        if (registry.harvestOf(lotId).state == IHarvestRegistry.HarvestState.Registered) {
            registry.markGraded(lotId, gradeClass);
        }
    }
}
