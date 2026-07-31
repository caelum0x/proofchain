// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Test double for the M4 ScoreOracle risk grade (0 = ungraded, 1 best .. 7 worst).
contract MockScoreOracle {
    mapping(address => uint8) private _grade;

    function setGrade(address supplier, uint8 grade) external {
        _grade[supplier] = grade;
    }

    function gradeOf(address supplier) external view returns (uint8) {
        return _grade[supplier];
    }
}
