// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Test double exposing the {IProvenanceRegistry} reads used by {ReceivableRegistry}.
contract MockProvenance {
    mapping(bytes32 => address) private _supplier;
    mapping(bytes32 => bool) private _exists;

    function setBatch(bytes32 batchId, address supplier) external {
        _supplier[batchId] = supplier;
        _exists[batchId] = true;
    }

    function batchExists(bytes32 batchId) external view returns (bool) {
        return _exists[batchId];
    }

    function batchSupplier(bytes32 batchId) external view returns (address) {
        return _supplier[batchId];
    }
}
