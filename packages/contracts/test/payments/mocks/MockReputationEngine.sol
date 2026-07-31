// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IReputationEngine } from "../../../src/interfaces/IReputationEngine.sol";

/// @notice Minimal {IReputationEngine} stand-in for exercising the escrow/router reputation hook.
/// @dev Records the last outcome and a call counter. `shouldRevert` proves the hook degrades
///      gracefully (settlement must not brick when the engine reverts).
contract MockReputationEngine is IReputationEngine {
    struct LastOutcome {
        address supplier;
        bool passed;
        uint16 score;
    }

    LastOutcome public last;
    uint256 public calls;
    mapping(address => uint256) public recorded;
    bool public shouldRevert;

    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }

    function recordOutcome(address supplier, bool passed, uint16 score) external override {
        if (shouldRevert) revert("reputation: forced revert");
        last = LastOutcome({ supplier: supplier, passed: passed, score: score });
        calls += 1;
        recorded[supplier] += 1;
        emit OutcomeRecorded(supplier, passed, score, score);
    }

    function reputationOf(address)
        external
        pure
        override
        returns (uint16 avgScoreBps, uint256 totalDeals, uint16 passRateBps, uint256 disputes)
    {
        return (0, 0, 0, 0);
    }
}
