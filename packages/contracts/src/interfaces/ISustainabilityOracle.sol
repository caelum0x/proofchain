// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ISustainabilityOracle
/// @notice Keeper-fed emissions/energy data per batch (KEEPER_ROLE).
interface ISustainabilityOracle {
    event EmissionsPushed(bytes32 indexed batchId, uint256 co2e, address indexed keeper);

    error UnknownBatch(bytes32 batchId);
    error NotKeeper(address caller);

    /// @notice Push measured CO2-equivalent emissions (grams) for a batch. KEEPER_ROLE only.
    function pushEmissions(bytes32 batchId, uint256 co2e) external;

    /// @notice Latest recorded emissions for a batch.
    function emissionsOf(bytes32 batchId) external view returns (uint256);
}
