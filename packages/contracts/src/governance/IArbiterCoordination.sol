// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IArbiterCoordination
/// @notice Module-internal surface the {DisputeArbitration} contract uses to keep an arbiter's
///         staking state in lockstep with dispute lifecycle events (vote locks + slashing).
/// @dev Implemented by {ArbiterStaking}; all functions are restricted to the registered
///      DisputeArbitration address. Kept separate from {IArbiterStaking} (the public surface) so
///      peers still import ArbiterStaking exclusively through interfaces.
interface IArbiterCoordination {
    /// @notice Record that `arbiter` cast a vote on an open dispute (locks their stake).
    function onVoteCast(address arbiter) external;

    /// @notice Record that a dispute `arbiter` voted on has resolved (releases one vote lock).
    function onDisputeResolved(address arbiter) external;

    /// @notice Reconcile bookkeeping after `amount` of `arbiter`'s stake was slashed on resolution.
    function onArbiterSlashed(address arbiter, uint256 amount) external;

    /// @notice Number of unresolved votes currently locking `arbiter`'s stake.
    function pendingVotesOf(address arbiter) external view returns (uint256);
}
