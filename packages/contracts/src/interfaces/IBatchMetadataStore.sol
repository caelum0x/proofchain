// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IBatchMetadataStore
/// @notice Rich structured key/value metadata kept off the ProvenanceRegistry hot path.
interface IBatchMetadataStore {
    struct KV {
        bytes32 key;
        string value;
    }

    event MetadataSet(bytes32 indexed batchId, bytes32 indexed key, string value);

    error UnknownBatch(bytes32 batchId);
    error NotBatchSupplier(bytes32 batchId);
    error EmptyKeys();

    /// @notice Set a batch of key/value metadata entries for a batch.
    function setMetadata(bytes32 batchId, KV[] calldata kvs) external;

    /// @notice Read a single metadata value.
    function getMetadata(bytes32 batchId, bytes32 key) external view returns (string memory);

    /// @notice Enumerate all keys set for a batch.
    function keysOf(bytes32 batchId) external view returns (bytes32[] memory);
}
