// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ProvenanceRegistry
/// @notice Append-only record of shipment batches and their checkpoints (the "ground truth").
/// @dev Suppliers/carriers holding REGISTRAR_ROLE register batches and append checkpoints.
contract ProvenanceRegistry is AccessControl {
    /// @notice Role allowed to register batches and append checkpoints.
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

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

    mapping(bytes32 => Batch) private _batches;
    mapping(bytes32 => Checkpoint[]) private _checkpoints;

    event BatchRegistered(bytes32 indexed batchId, address indexed supplier, bytes32 originHash, string metadataURI);
    event CheckpointAdded(bytes32 indexed batchId, string location, uint64 timestamp, bytes32 dataHash);

    error BatchExists(bytes32 batchId);
    error UnknownBatch(bytes32 batchId);
    error EmptyMetadata();

    /// @param admin Address granted DEFAULT_ADMIN_ROLE and REGISTRAR_ROLE at deploy time.
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
    }

    /// @notice Register a new shipment batch. Caller becomes the supplier.
    /// @param batchId Unique batch identifier.
    /// @param originHash Hash committing to origin data.
    /// @param metadataURI Off-chain metadata pointer (must be non-empty).
    function registerBatch(bytes32 batchId, bytes32 originHash, string calldata metadataURI)
        external
        onlyRole(REGISTRAR_ROLE)
    {
        if (_batches[batchId].exists) revert BatchExists(batchId);
        if (bytes(metadataURI).length == 0) revert EmptyMetadata();

        _batches[batchId] = Batch({
            batchId: batchId,
            supplier: msg.sender,
            originHash: originHash,
            metadataURI: metadataURI,
            createdAt: uint64(block.timestamp),
            exists: true
        });

        emit BatchRegistered(batchId, msg.sender, originHash, metadataURI);
    }

    /// @notice Append a checkpoint to an existing batch (append-only).
    /// @param batchId Target batch (must exist).
    /// @param location Free-form location label.
    /// @param timestamp Caller-supplied checkpoint timestamp.
    /// @param dataHash Hash committing to checkpoint payload.
    function addCheckpoint(bytes32 batchId, string calldata location, uint64 timestamp, bytes32 dataHash)
        external
        onlyRole(REGISTRAR_ROLE)
    {
        if (!_batches[batchId].exists) revert UnknownBatch(batchId);

        _checkpoints[batchId].push(
            Checkpoint({ batchId: batchId, location: location, timestamp: timestamp, dataHash: dataHash })
        );

        emit CheckpointAdded(batchId, location, timestamp, dataHash);
    }

    /// @notice Fetch a batch by id.
    function getBatch(bytes32 batchId) external view returns (Batch memory) {
        return _batches[batchId];
    }

    /// @notice Fetch all checkpoints for a batch.
    function getCheckpoints(bytes32 batchId) external view returns (Checkpoint[] memory) {
        return _checkpoints[batchId];
    }

    /// @notice Number of checkpoints recorded for a batch.
    function checkpointCount(bytes32 batchId) external view returns (uint256) {
        return _checkpoints[batchId].length;
    }

    /// @notice Convenience existence check.
    function batchExists(bytes32 batchId) external view returns (bool) {
        return _batches[batchId].exists;
    }

    /// @notice The supplier that registered a batch (zero address if unknown).
    function batchSupplier(bytes32 batchId) external view returns (address) {
        return _batches[batchId].supplier;
    }
}
