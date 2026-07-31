// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Roles
/// @notice Canonical `bytes32` role identifiers shared across every ProofChain module.
/// @dev These are the exact `keccak256` hashes used with OpenZeppelin `AccessControl`.
///      `DEFAULT_ADMIN_ROLE` (== bytes32(0)) is provided by OpenZeppelin and intentionally
///      not redefined here. Existing root contracts already use `REGISTRAR_ROLE` /
///      `AGENT_ROLE` computed identically, so their hashes line up 1:1 with this library.
library Roles {
    /// @notice Suppliers/carriers permitted to register batches and append checkpoints (M1).
    bytes32 internal constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    /// @notice The AI verification agent keypair permitted to write attestations.
    bytes32 internal constant AGENT_ROLE = keccak256("AGENT_ROLE");

    /// @notice Trusted off-chain keepers pushing oracle feeds (checkpoints, emissions).
    bytes32 internal constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    /// @notice Contracts/actors allowed to record reputation outcomes (M4).
    bytes32 internal constant REPUTATION_UPDATER_ROLE = keccak256("REPUTATION_UPDATER_ROLE");

    /// @notice Authorised to slash bonds/stakes on proven fraud (M4).
    bytes32 internal constant SLASHER_ROLE = keccak256("SLASHER_ROLE");

    /// @notice Staked arbiters that resolve disputes and can trigger arbiter releases (M2/M7).
    bytes32 internal constant ARBITER_ROLE = keccak256("ARBITER_ROLE");

    /// @notice Permitted to mint tokens (NFTs, governance token, loyalty points, carbon credits).
    bytes32 internal constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Permitted to withdraw protocol funds from the Treasury (M2).
    bytes32 internal constant TREASURER_ROLE = keccak256("TREASURER_ROLE");

    /// @notice Manages financing/insurance pool parameters and allocations (M5/M6).
    bytes32 internal constant POOL_MANAGER_ROLE = keccak256("POOL_MANAGER_ROLE");

    /// @notice Governance executor (timelock) permitted to change protocol params (M7).
    bytes32 internal constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");

    /// @notice KYC providers permitted to set KYC status per address (M3).
    bytes32 internal constant KYC_PROVIDER_ROLE = keccak256("KYC_PROVIDER_ROLE");

    /// @notice Global pause guardians (M0 Pauser and per-module pausing).
    bytes32 internal constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
}
