// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { Roles } from "../core/Roles.sol";
import { ICheckpointOracle } from "../interfaces/ICheckpointOracle.sol";
import { IProvenanceRegistry } from "../interfaces/IProvenanceRegistry.sol";

/// @title CheckpointOracle
/// @notice Trusted IoT/carrier checkpoint feed. Keepers push signed sensor readings which are
///         appended to the append-only {ProvenanceRegistry} as canonical checkpoints.
/// @dev Resolves the ProvenanceRegistry through the {AddressBook} (never a hardcoded peer).
///      For appends to succeed on-chain the deployer must grant this contract the registry's
///      `REGISTRAR_ROLE`; that wiring is a deployment concern, not encoded here.
contract CheckpointOracle is ProofChainAccess, ICheckpointOracle {
    /// @param addressBook_ Deployed {AddressBook} used to resolve the ProvenanceRegistry.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial KEEPER_ROLE.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) {
        _grantRole(Roles.KEEPER_ROLE, admin);
    }

    /// @inheritdoc ICheckpointOracle
    function pushCheckpoint(bytes32 batchId, string calldata location, int256 temp, bytes32 dataHash) external {
        // Respect the protocol-wide circuit breaker (no-op until a Pauser is wired).
        _requireNotGloballyPaused();

        // Custom-error access control so integrators get the documented {NotKeeper} revert.
        if (!hasRole(Roles.KEEPER_ROLE, msg.sender)) revert NotKeeper(msg.sender);

        IProvenanceRegistry registry = IProvenanceRegistry(_addr(Keys.PROVENANCE_REGISTRY));

        // Validate the target batch exists in the ground-truth registry before appending.
        if (!registry.batchExists(batchId)) revert UnknownBatch(batchId);

        // Timestamp the reading with block time; the oracle is the trusted clock for feeds.
        registry.addCheckpoint(batchId, location, uint64(block.timestamp), dataHash);

        emit CheckpointPushed(batchId, location, temp, dataHash, msg.sender);
    }
}
