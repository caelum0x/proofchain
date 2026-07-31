// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IScoreOracle } from "../../../src/interfaces/IScoreOracle.sol";

/// @notice Configurable ScoreOracle stub for the insurance test-suite.
contract MockScoreOracle is IScoreOracle {
    mapping(address => uint8) private _grades;

    function setGrade(address supplier, uint8 grade) external {
        _grades[supplier] = grade;
    }

    function gradeOf(address supplier) external view returns (uint8) {
        return _grades[supplier];
    }
}
