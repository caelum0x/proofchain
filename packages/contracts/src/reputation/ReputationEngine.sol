// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Roles } from "../core/Roles.sol";
import { IReputationEngine } from "../interfaces/IReputationEngine.sol";

/// @title ReputationEngine
/// @notice On-chain reputation per supplier, updated by REPUTATION_UPDATER_ROLE holders
///         (the {SettlementEscrow} / {SettlementRouter}) whenever a deal settles.
/// @dev Tracks a running average attestation score, total deals, pass rate, and dispute count.
///      A "passed" outcome is a clean release; a failing outcome is counted as a dispute.
///      Scores are basis points (0..10000). All updates emit {OutcomeRecorded} for indexing.
contract ReputationEngine is ProofChainAccess, IReputationEngine {
    /// @notice Maximum score in basis points.
    uint16 public constant MAX_BPS = 10_000;

    /// @dev Full accounting for a supplier. Public getters derive the {Reputation} view from this.
    struct Record {
        uint256 scoreSum; // sum of all recorded scores (bps), for the running average
        uint256 totalDeals; // number of outcomes recorded
        uint256 passCount; // number of passing outcomes
        uint256 disputes; // number of failing (disputed) outcomes
    }

    mapping(address => Record) private _records;

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IReputationEngine
    /// @dev REPUTATION_UPDATER_ROLE only. Idempotency is the caller's responsibility (one call per
    ///      settled deal); this contract accumulates every call it is given.
    function recordOutcome(address supplier, bool passed, uint16 score)
        external
        override
        onlyRole(Roles.REPUTATION_UPDATER_ROLE)
    {
        if (supplier == address(0)) revert ZeroAddress();
        if (score > MAX_BPS) revert IReputationEngine.InvalidScore(score);

        Record storage rec = _records[supplier];
        rec.scoreSum += score;
        rec.totalDeals += 1;
        if (passed) {
            rec.passCount += 1;
        } else {
            rec.disputes += 1;
        }

        uint16 newAvg = uint16(rec.scoreSum / rec.totalDeals);
        emit OutcomeRecorded(supplier, passed, score, newAvg);
    }

    /// @inheritdoc IReputationEngine
    function reputationOf(address supplier)
        external
        view
        override
        returns (uint16 avgScoreBps, uint256 totalDeals, uint16 passRateBps, uint256 disputes)
    {
        Record storage rec = _records[supplier];
        totalDeals = rec.totalDeals;
        disputes = rec.disputes;
        if (totalDeals == 0) {
            return (0, 0, 0, 0);
        }
        avgScoreBps = uint16(rec.scoreSum / totalDeals);
        passRateBps = uint16((rec.passCount * MAX_BPS) / totalDeals);
    }
}
