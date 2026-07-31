// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ICheckpointOracle
/// @notice Trusted IoT/carrier checkpoint feed that appends checkpoints to the ProvenanceRegistry.
/// @dev Keepers (KEEPER_ROLE) push signed sensor readings; deps: ProvenanceRegistry via AddressBook.
interface ICheckpointOracle {
    event CheckpointPushed(
        bytes32 indexed batchId, string location, int256 temp, bytes32 dataHash, address indexed keeper
    );

    error UnknownBatch(bytes32 batchId);
    error NotKeeper(address caller);

    /// @notice Push a checkpoint reading for a known batch. KEEPER_ROLE only.
    /// @param batchId Target batch.
    /// @param location Free-form location label.
    /// @param temp Measured temperature (signed, e.g. milli-degrees C).
    /// @param dataHash Hash committing to the full sensor payload.
    function pushCheckpoint(bytes32 batchId, string calldata location, int256 temp, bytes32 dataHash) external;
}
