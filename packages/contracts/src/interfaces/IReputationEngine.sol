// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IReputationEngine
/// @notice On-chain reputation per supplier, updated by REPUTATION_UPDATER_ROLE (escrow/router).
interface IReputationEngine {
    struct Reputation {
        uint16 avgScoreBps;
        uint256 totalDeals;
        uint16 passRateBps;
        uint256 disputes;
    }

    event OutcomeRecorded(address indexed supplier, bool passed, uint16 score, uint16 newAvgScoreBps);

    error InvalidScore(uint16 score);

    /// @notice Record a settlement outcome for a supplier. REPUTATION_UPDATER_ROLE only.
    function recordOutcome(address supplier, bool passed, uint16 score) external;

    /// @notice Aggregate reputation for a supplier.
    function reputationOf(address supplier)
        external
        view
        returns (uint16 avgScoreBps, uint256 totalDeals, uint16 passRateBps, uint256 disputes);
}
