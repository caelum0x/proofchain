// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IOffsetMarketplace
/// @notice Buy and retire carbon credits against a batch's measured footprint.
/// @dev deps (AddressBook): CarbonCreditToken, ESGRegistry, SustainabilityOracle.
interface IOffsetMarketplace {
    event Offset(bytes32 indexed batchId, address indexed account, uint256 projectId, uint256 amount);

    error ZeroAmount();
    error NothingToOffset(bytes32 batchId);

    /// @notice Retire `amount` of carbon credits from `projectId` against a batch's footprint.
    function offset(bytes32 batchId, uint256 projectId, uint256 amount) external;

    /// @notice Remaining un-offset footprint (grams CO2e) for a batch.
    function remainingFootprint(bytes32 batchId) external view returns (uint256);
}
