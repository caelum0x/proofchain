// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IProvenanceFactory
/// @notice Batch-series / templated registration helper on top of the ProvenanceRegistry.
/// @dev Lets a supplier define a reusable series template then mint many batches from it.
interface IProvenanceFactory {
    struct Series {
        bytes32 seriesId;
        address creator;
        string metadataURI;
        uint64 createdAt;
        uint256 count;
        bool exists;
    }

    event SeriesCreated(bytes32 indexed seriesId, address indexed creator, string metadataURI);
    event RegisteredFromSeries(bytes32 indexed seriesId, bytes32 indexed batchId, uint256 index);

    error SeriesExists(bytes32 seriesId);
    error UnknownSeries(bytes32 seriesId);
    error NotSeriesCreator(bytes32 seriesId);
    error EmptyMetadata();

    /// @notice Create a reusable series template.
    function createSeries(bytes32 seriesId, string calldata metadataURI) external;

    /// @notice Register a new batch derived from a series template.
    function registerFromSeries(bytes32 seriesId, bytes32 batchId, bytes32 originHash) external;

    function seriesOf(bytes32 seriesId) external view returns (Series memory);
}
