// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ProofChainAccess } from "../core/ProofChainAccess.sol";
import { Keys } from "../core/Keys.sol";
import { IDisputeArbitration } from "../interfaces/IDisputeArbitration.sol";
import { ISettlementEscrow } from "../interfaces/ISettlementEscrow.sol";
import { IArbiterStaking } from "../interfaces/IArbiterStaking.sol";
import { IStakeManager } from "../interfaces/IStakeManager.sol";
import { IArbiterCoordination } from "./IArbiterCoordination.sol";

/// @title DisputeArbitration
/// @notice Staked arbiters vote on `Disputed` escrow deals; the majority decides whether to refund
///         the buyer or release the escrowed funds to the (possibly financing-assigned) payee.
/// @dev Peers are resolved via the {AddressBook}: {SettlementEscrow} (outcome execution),
///      {ArbiterStaking} (eligibility + vote-lock/slash coordination), and {StakeManager} (direct
///      stake seizure of losing voters, routed to the {Treasury}). Voting has a fixed window;
///      resolution is single-shot and idempotent-guarded. `resolve` moves funds via the escrow and
///      is `nonReentrant`. Minority (losing-side) voters are slashed by `slashPenalty` (0 disables),
///      capped at each voter's committed stake so one under-staked arbiter can never brick a
///      resolution.
contract DisputeArbitration is ProofChainAccess, ReentrancyGuard, IDisputeArbitration {
    /// @notice Voting window (seconds) after {openDispute} before {resolve} may be called.
    uint64 public votingPeriod;

    /// @notice Flat stake penalty seized from each losing-side voter on resolution (0 = disabled).
    uint256 public slashPenalty;

    mapping(bytes32 => Dispute) private _disputes;
    mapping(bytes32 => address[]) private _voters;
    mapping(bytes32 => mapping(address => bool)) private _hasVoted;
    /// @dev Records each voter's choice (true = refund buyer) to slash the losing side on resolve.
    mapping(bytes32 => mapping(address => bool)) private _voteRefund;

    event VotingPeriodUpdated(uint64 oldPeriod, uint64 newPeriod);
    event SlashPenaltyUpdated(uint256 oldPenalty, uint256 newPenalty);
    event ArbiterSlashed(bytes32 indexed batchId, address indexed arbiter, uint256 amount);

    error NotDisputedDeal(bytes32 batchId);
    error NoVotes(bytes32 batchId);
    error ZeroVotingPeriod();

    /// @param addressBook_ Deployed {AddressBook}.
    /// @param admin Address granted DEFAULT_ADMIN_ROLE for this module.
    /// @param votingPeriod_ Initial voting window in seconds.
    /// @param slashPenalty_ Initial per-loser slash penalty (0 disables slashing).
    constructor(address addressBook_, address admin, uint64 votingPeriod_, uint256 slashPenalty_)
        ProofChainAccess(addressBook_, admin)
    {
        if (votingPeriod_ == 0) revert ZeroVotingPeriod();
        votingPeriod = votingPeriod_;
        slashPenalty = slashPenalty_;
        emit VotingPeriodUpdated(0, votingPeriod_);
        emit SlashPenaltyUpdated(0, slashPenalty_);
    }

    /// @notice Update the voting window. Admin only.
    function setVotingPeriod(uint64 newPeriod) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newPeriod == 0) revert ZeroVotingPeriod();
        emit VotingPeriodUpdated(votingPeriod, newPeriod);
        votingPeriod = newPeriod;
    }

    /// @notice Update the per-loser slash penalty. Admin only.
    function setSlashPenalty(uint256 newPenalty) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit SlashPenaltyUpdated(slashPenalty, newPenalty);
        slashPenalty = newPenalty;
    }

    /// @inheritdoc IDisputeArbitration
    /// @dev Callable by anyone once the escrow deal for `batchId` is in the `Disputed` state.
    function openDispute(bytes32 batchId) external {
        _requireNotGloballyPaused();
        if (_disputes[batchId].state != DisputeState.None) revert DisputeExists(batchId);

        ISettlementEscrow escrow = ISettlementEscrow(_addr(Keys.SETTLEMENT_ESCROW));
        if (escrow.getDeal(batchId).state != ISettlementEscrow.DealState.Disputed) {
            revert NotDisputedDeal(batchId);
        }

        _disputes[batchId] = Dispute({
            batchId: batchId,
            openedAt: uint64(block.timestamp),
            votesRefund: 0,
            votesRelease: 0,
            state: DisputeState.Open,
            refundedBuyer: false
        });

        emit DisputeOpened(batchId, msg.sender);
    }

    /// @inheritdoc IDisputeArbitration
    /// @dev One vote per arbiter per dispute. Casting a vote locks the arbiter's stake until resolution.
    function vote(bytes32 batchId, bool refundBuyer) external {
        Dispute storage dispute = _disputes[batchId];
        if (dispute.state != DisputeState.Open) revert DisputeNotOpen(batchId);

        IArbiterStaking arbiters = IArbiterStaking(_addr(Keys.ARBITER_STAKING));
        if (!arbiters.isArbiter(msg.sender)) revert NotArbiter(msg.sender);
        if (_hasVoted[batchId][msg.sender]) revert AlreadyVoted(batchId, msg.sender);

        _hasVoted[batchId][msg.sender] = true;
        _voteRefund[batchId][msg.sender] = refundBuyer;
        _voters[batchId].push(msg.sender);

        if (refundBuyer) {
            dispute.votesRefund += 1;
        } else {
            dispute.votesRelease += 1;
        }

        // Lock the arbiter's stake for the duration of this dispute.
        IArbiterCoordination(address(arbiters)).onVoteCast(msg.sender);

        emit Voted(batchId, msg.sender, refundBuyer);
    }

    /// @inheritdoc IDisputeArbitration
    /// @dev Callable by anyone after the voting window closes. Executes the majority outcome on the
    ///      escrow, releases vote locks, and slashes losing-side voters. `refundBuyer` wins ties in
    ///      favour of the buyer (funds returned) as the safer default for the party out-of-pocket.
    function resolve(bytes32 batchId) external nonReentrant {
        Dispute storage dispute = _disputes[batchId];
        if (dispute.state != DisputeState.Open) revert DisputeNotOpen(batchId);
        if (block.timestamp < dispute.openedAt + votingPeriod) revert VotingOngoing(batchId);

        uint256 refundVotes = dispute.votesRefund;
        uint256 releaseVotes = dispute.votesRelease;
        if (refundVotes + releaseVotes == 0) revert NoVotes(batchId);

        bool refundBuyer = refundVotes >= releaseVotes;
        dispute.state = DisputeState.Resolved;
        dispute.refundedBuyer = refundBuyer;

        // Execute the outcome on the escrow.
        ISettlementEscrow escrow = ISettlementEscrow(_addr(Keys.SETTLEMENT_ESCROW));
        if (refundBuyer) {
            escrow.refund(batchId);
        } else {
            escrow.arbiterRelease(batchId);
        }

        _finalizeVoters(batchId, refundBuyer);

        emit Resolved(batchId, refundBuyer);
    }

    /// @inheritdoc IDisputeArbitration
    function disputeOf(bytes32 batchId) external view returns (Dispute memory) {
        return _disputes[batchId];
    }

    /// @notice Whether `arbiter` has already voted on `batchId`.
    function hasVoted(bytes32 batchId, address arbiter) external view returns (bool) {
        return _hasVoted[batchId][arbiter];
    }

    /// @notice Number of arbiters that voted on `batchId`.
    function voterCount(bytes32 batchId) external view returns (uint256) {
        return _voters[batchId].length;
    }

    // --- internal --------------------------------------------------------------------------

    /// @dev Release each voter's vote lock and slash those who backed the losing side.
    function _finalizeVoters(bytes32 batchId, bool refundBuyer) private {
        address[] storage voters = _voters[batchId];
        uint256 penalty = slashPenalty;
        IArbiterStaking arbiters = IArbiterStaking(_addr(Keys.ARBITER_STAKING));
        IArbiterCoordination coordination = IArbiterCoordination(address(arbiters));

        // Resolve the slash sink lazily; skip slashing entirely if unset or disabled.
        address treasury = penalty == 0 ? address(0) : _addrOrZero(Keys.TREASURY);
        IStakeManager stakeManager =
            treasury == address(0) ? IStakeManager(address(0)) : IStakeManager(_addr(Keys.STAKE_MANAGER));

        uint256 len = voters.length;
        for (uint256 i = 0; i < len; ++i) {
            address voter = voters[i];

            // Slash the loser side, capped at their committed stake so resolution never reverts.
            if (address(stakeManager) != address(0) && _voteRefund[batchId][voter] != refundBuyer) {
                uint256 committed = arbiters.stakeOf(voter);
                uint256 amount = penalty > committed ? committed : penalty;
                if (amount != 0) {
                    stakeManager.slash(voter, amount, treasury);
                    coordination.onArbiterSlashed(voter, amount);
                    emit ArbiterSlashed(batchId, voter, amount);
                }
            }

            // Release the vote lock regardless of which side the arbiter backed.
            coordination.onDisputeResolved(voter);
        }
    }
}
