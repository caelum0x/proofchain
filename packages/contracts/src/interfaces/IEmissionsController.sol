// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IEmissionsController
/// @notice Controls the reward emission rate across epochs.
interface IEmissionsController {
    event EmissionRateSet(uint256 indexed epoch, uint256 rate);

    error InvalidRate(uint256 rate);

    /// @notice Set the per-second emission rate for the current/next epoch. GOVERNOR_ROLE only.
    function setEmissionRate(uint256 rate) external;

    /// @notice Current per-second emission rate.
    function currentRate() external view returns (uint256);

    /// @notice The active epoch index.
    function currentEpoch() external view returns (uint256);
}
