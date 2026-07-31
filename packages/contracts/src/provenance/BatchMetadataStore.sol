// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IBatchMetadataStore } from "../interfaces/IBatchMetadataStore.sol";
import { IProvenanceRegistry } from "../interfaces/IProvenanceRegistry.sol";

/// @title BatchMetadataStore
/// @notice Rich structured key/value metadata for batches, kept off the {ProvenanceRegistry}
///         hot path so the append-only ground truth stays lean.
/// @dev Only the batch's registered supplier may write its metadata. The supplier is resolved
///      from the {ProvenanceRegistry} via the {AddressBook}; keys are enumerable and values
///      are overwritable in place without duplicating key entries.
contract BatchMetadataStore is ProofChainAccess, IBatchMetadataStore {
    /// @dev batchId => key => value.
    mapping(bytes32 => mapping(bytes32 => string)) private _values;
    /// @dev batchId => ordered list of keys that have been set at least once.
    mapping(bytes32 => bytes32[]) private _keys;
    /// @dev batchId => key => whether the key is already tracked in `_keys`.
    mapping(bytes32 => mapping(bytes32 => bool)) private _keySeen;

    /// @param addressBook_ Deployed {AddressBook} used to resolve the ProvenanceRegistry.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    constructor(address addressBook_, address admin) ProofChainAccess(addressBook_, admin) { }

    /// @inheritdoc IBatchMetadataStore
    function setMetadata(bytes32 batchId, KV[] calldata kvs) external {
        _requireNotGloballyPaused();

        if (kvs.length == 0) revert EmptyKeys();

        IProvenanceRegistry registry = IProvenanceRegistry(_addr(Keys.PROVENANCE_REGISTRY));
        if (!registry.batchExists(batchId)) revert UnknownBatch(batchId);
        if (registry.batchSupplier(batchId) != msg.sender) revert NotBatchSupplier(batchId);

        for (uint256 i = 0; i < kvs.length; ++i) {
            bytes32 key = kvs[i].key;
            _values[batchId][key] = kvs[i].value;
            if (!_keySeen[batchId][key]) {
                _keySeen[batchId][key] = true;
                _keys[batchId].push(key);
            }
            emit MetadataSet(batchId, key, kvs[i].value);
        }
    }

    /// @inheritdoc IBatchMetadataStore
    function getMetadata(bytes32 batchId, bytes32 key) external view returns (string memory) {
        return _values[batchId][key];
    }

    /// @inheritdoc IBatchMetadataStore
    function keysOf(bytes32 batchId) external view returns (bytes32[] memory) {
        return _keys[batchId];
    }
}
