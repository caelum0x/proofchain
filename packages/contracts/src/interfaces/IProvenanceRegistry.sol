// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Minimal read interface of ProvenanceRegistry consumed by SettlementEscrow.
interface IProvenanceRegistry {
    function batchExists(bytes32 batchId) external view returns (bool);
    function batchSupplier(bytes32 batchId) external view returns (address);
}
