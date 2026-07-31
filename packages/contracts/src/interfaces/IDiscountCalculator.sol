// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IDiscountCalculator
/// @notice Computes the advance (discounted) amount from face value, risk grade, and tenor.
/// @dev Pure/view financial math; no state or fund movement.
interface IDiscountCalculator {
    error InvalidGrade(uint8 grade);
    error ZeroFaceValue();

    /// @notice Advance amount payable now for a receivable.
    /// @param face Face value of the receivable.
    /// @param grade Risk grade (1 best .. 7 worst).
    /// @param tenorDays Days until the receivable is due.
    function advanceFor(uint256 face, uint8 grade, uint256 tenorDays) external view returns (uint256);

    /// @notice Effective discount applied, in basis points.
    function discountBps(uint8 grade, uint256 tenorDays) external view returns (uint16);
}
