// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";

/// @title ProofChainTimelock
/// @notice Executes governance proposals after a mandatory delay. Thin wrapper over the audited
///         OpenZeppelin {TimelockController} so peers can resolve it via {IProofChainTimelock}.
/// @dev The {ProofChainGovernor} is granted `PROPOSER_ROLE`/`CANCELLER_ROLE`; execution is usually
///      left open (`EXECUTOR_ROLE` to `address(0)`) or restricted to keepers. The timelock itself
///      becomes the protocol admin (holder of privileged roles across modules) so that all
///      parameter changes flow through on-chain governance + delay.
contract ProofChainTimelock is TimelockController {
    /// @param minDelay Minimum delay (seconds) between queueing and execution.
    /// @param proposers Addresses granted PROPOSER_ROLE (the Governor).
    /// @param executors Addresses granted EXECUTOR_ROLE (use `address(0)` to allow anyone).
    /// @param admin Optional bootstrap admin; pass `address(0)` to renounce admin at deploy.
    constructor(uint256 minDelay, address[] memory proposers, address[] memory executors, address admin)
        TimelockController(minDelay, proposers, executors, admin)
    { }
}
