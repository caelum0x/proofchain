// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Governor } from "@openzeppelin/contracts/governance/Governor.sol";
import { GovernorSettings } from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import { GovernorCountingSimple } from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import { GovernorVotes } from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import { GovernorVotesQuorumFraction } from
    "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import { GovernorTimelockControl } from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { IVotes } from "@openzeppelin/contracts/governance/utils/IVotes.sol";

import { IAddressBook } from "../interfaces/IAddressBook.sol";
import { Keys } from "../core/Keys.sol";

/// @title ProofChainGovernor
/// @notice On-chain governor over ProofChain protocol parameters (fees, thresholds, wiring).
/// @dev Composes the audited OpenZeppelin Governor stack: token-weighted voting
///      ({GovernorVotes}) with a quorum fraction, simple For/Against/Abstain counting, tunable
///      settings, and timelocked execution ({GovernorTimelockControl}). The governance token and
///      timelock are resolved through the {AddressBook} at deploy time (never hardcoded), honoring
///      the platform's registry-based wiring. Proposals therefore execute via the timelock, which
///      is the privileged admin across modules.
contract ProofChainGovernor is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    /// @param addressBook_ Deployed {AddressBook}; must have GovernanceToken and Timelock registered.
    /// @param votingDelay_ Delay (in blocks) before voting starts after a proposal is created.
    /// @param votingPeriod_ Duration (in blocks) of the voting window.
    /// @param proposalThreshold_ Minimum votes required to submit a proposal.
    /// @param quorumPercent_ Quorum as a percentage (1..100) of total voting supply.
    constructor(
        address addressBook_,
        uint48 votingDelay_,
        uint32 votingPeriod_,
        uint256 proposalThreshold_,
        uint256 quorumPercent_
    )
        Governor("ProofChainGovernor")
        GovernorSettings(votingDelay_, votingPeriod_, proposalThreshold_)
        GovernorVotes(IVotes(IAddressBook(addressBook_).requireAddress(Keys.GOVERNANCE_TOKEN)))
        GovernorVotesQuorumFraction(quorumPercent_)
        GovernorTimelockControl(
            TimelockController(payable(IAddressBook(addressBook_).requireAddress(Keys.PROOFCHAIN_TIMELOCK)))
        )
    { }

    // --- required multiple-inheritance overrides -------------------------------------------

    function votingDelay() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }

    function quorum(uint256 timepoint)
        public
        view
        override(Governor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(timepoint);
    }

    function state(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function proposalNeedsQueuing(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (bool)
    {
        return super.proposalNeedsQueuing(proposalId);
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) {
        return super._executor();
    }
}
