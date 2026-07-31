// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IPremiumCalculator
/// @notice Computes an insurance premium from coverage and the supplier's risk grade.
/// @dev deps (AddressBook): ScoreOracle. View-only financial math.
interface IPremiumCalculator {
    error InvalidGrade(uint8 grade);
    error ZeroCoverage();

    /// @notice Premium payable for `coverage` at risk `grade` (1 best .. 7 worst).
    function premiumFor(uint256 coverage, uint8 grade) external view returns (uint256);

    /// @notice Premium rate in basis points for a grade.
    function premiumBps(uint8 grade) external view returns (uint16);
}
