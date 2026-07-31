// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ISettlementRouter
/// @notice Orchestrates attest -> settle -> reputation -> fees in a single call.
/// @dev deps (AddressBook): SettlementEscrow, AttestationRegistry, ReputationEngine, FeeManager.
interface ISettlementRouter {
    event FullySettled(bytes32 indexed batchId, bool released, uint16 score);

    error NotAttested(bytes32 batchId);
    error NotFunded(bytes32 batchId);

    /// @notice Run the full settlement pipeline for a batch.
    /// @return released True if funds were released to the payee, false if moved to disputed.
    function settleFull(bytes32 batchId) external returns (bool released);
}
