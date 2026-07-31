// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IEscrowFactory
/// @notice Deploys per-deal or per-organization SettlementEscrow instances.
interface IEscrowFactory {
    event EscrowCreated(bytes32 indexed salt, address indexed escrow, address indexed admin);

    error EscrowAlreadyCreated(bytes32 salt);

    /// @notice Deploy a new escrow bound to the shared attestation/provenance registries.
    /// @return escrow Address of the newly created escrow.
    function createEscrow(bytes32 salt, address admin) external returns (address escrow);

    /// @notice Escrow previously created for `salt` (zero if none).
    function escrowOf(bytes32 salt) external view returns (address);

    /// @notice All escrows created by this factory.
    function allEscrows() external view returns (address[] memory);
}
