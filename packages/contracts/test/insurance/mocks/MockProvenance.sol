// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Minimal provenance stub exposing only `batchSupplier` for grade resolution.
/// @dev ABI-compatible with `IProvenanceRegistry.batchSupplier(bytes32)`.
contract MockProvenance {
    mapping(bytes32 => address) private _supplier;

    function setSupplier(bytes32 batchId, address supplier) external {
        _supplier[batchId] = supplier;
    }

    function batchSupplier(bytes32 batchId) external view returns (address) {
        return _supplier[batchId];
    }
}
