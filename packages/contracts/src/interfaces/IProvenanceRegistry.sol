// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IProvenanceRegistry
/// @notice Full external surface of the append-only batch/checkpoint ground-truth registry.
/// @dev Peers (escrow, attestation, finance, ESG) import THIS interface, never the impl.
interface IProvenanceRegistry {
    struct Batch {
        bytes32 batchId;
        address supplier;
        bytes32 originHash;
        string metadataURI;
        uint64 createdAt;
        bool exists;
    }

    struct Checkpoint {
        bytes32 batchId;
        string location;
        uint64 timestamp;
        bytes32 dataHash;
    }

    event BatchRegistered(bytes32 indexed batchId, address indexed supplier, bytes32 originHash, string metadataURI);
    event CheckpointAdded(bytes32 indexed batchId, string location, uint64 timestamp, bytes32 dataHash);

    error BatchExists(bytes32 batchId);
    error UnknownBatch(bytes32 batchId);
    error EmptyMetadata();

    function REGISTRAR_ROLE() external view returns (bytes32);

    function registerBatch(bytes32 batchId, bytes32 originHash, string calldata metadataURI) external;
    function addCheckpoint(bytes32 batchId, string calldata location, uint64 timestamp, bytes32 dataHash) external;

    function getBatch(bytes32 batchId) external view returns (Batch memory);
    function getCheckpoints(bytes32 batchId) external view returns (Checkpoint[] memory);
    function checkpointCount(bytes32 batchId) external view returns (uint256);
    function batchExists(bytes32 batchId) external view returns (bool);
    function batchSupplier(bytes32 batchId) external view returns (address);
}
