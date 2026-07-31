/**
 * `governance` domain types.
 *
 * Mirrors the on-chain governance stack — the OpenZeppelin {ProofChainGovernor}
 * lifecycle, the {ProposalRegistry}, staked-arbiter {DisputeArbitration} +
 * {ArbiterStaking}, and the {GovernanceToken} mint — plus the request/response
 * DTOs the api/web layers exchange for these flows.
 *
 * The primary struct mirrors that are read straight off-chain ({@link Dispute},
 * {@link DisputeState}, {@link ProposalDescription}) live in `./core`; this
 * module adds the event payloads, the standard Governor state/vote enums, and
 * the boundary DTOs. Every field is `readonly`; `bigint` is used for
 * uint256/uint64/uint48, `number` for the small bounded enums, and the branded
 * `Address` / `Bytes32` / `Hex` types from `./core`.
 *
 * Re-exported by `../types/index.ts`.
 */
import type { Address, Bytes32, Hex } from "./core";
import type { Dispute, DisputeState } from "./core";

// ---------------------------------------------------------------------------
// OpenZeppelin Governor enums (values MUST match the OZ `IGovernor` / counting
// module ordering exactly — they are read straight off-chain).
// ---------------------------------------------------------------------------

/** Mirror of OpenZeppelin `IGovernor.ProposalState`. */
export enum ProposalState {
  Pending = 0,
  Active = 1,
  Canceled = 2,
  Defeated = 3,
  Succeeded = 4,
  Queued = 5,
  Expired = 6,
  Executed = 7,
}

export const PROPOSAL_STATE_LABELS: Readonly<Record<ProposalState, string>> =
  Object.freeze({
    [ProposalState.Pending]: "Pending",
    [ProposalState.Active]: "Active",
    [ProposalState.Canceled]: "Canceled",
    [ProposalState.Defeated]: "Defeated",
    [ProposalState.Succeeded]: "Succeeded",
    [ProposalState.Queued]: "Queued",
    [ProposalState.Expired]: "Expired",
    [ProposalState.Executed]: "Executed",
  });

/** Mirror of OpenZeppelin `GovernorCountingSimple.VoteType` (the `support` value). */
export enum GovernorVoteType {
  Against = 0,
  For = 1,
  Abstain = 2,
}

export const GOVERNOR_VOTE_TYPE_LABELS: Readonly<
  Record<GovernorVoteType, string>
> = Object.freeze({
  [GovernorVoteType.Against]: "Against",
  [GovernorVoteType.For]: "For",
  [GovernorVoteType.Abstain]: "Abstain",
});

// ---------------------------------------------------------------------------
// Governor lifecycle event payloads (ProofChainGovernor / OZ Governor)
// ---------------------------------------------------------------------------

/** Decoded `ProofChainGovernor.ProposalCreated`. */
export interface GovernorProposalCreatedEvent {
  readonly proposalId: bigint;
  readonly proposer: Address;
  readonly targets: readonly Address[];
  readonly values: readonly bigint[];
  readonly signatures: readonly string[];
  readonly calldatas: readonly Hex[];
  readonly voteStart: bigint;
  readonly voteEnd: bigint;
  readonly description: string;
}

/** Decoded `ProofChainGovernor.VoteCast`. */
export interface GovernorVoteCastEvent {
  readonly voter: Address;
  readonly proposalId: bigint;
  readonly support: GovernorVoteType;
  readonly weight: bigint;
  readonly reason: string;
}

/** Decoded `ProofChainGovernor.ProposalQueued`. */
export interface GovernorProposalQueuedEvent {
  readonly proposalId: bigint;
  readonly etaSeconds: bigint;
}

/** Decoded `ProofChainGovernor.ProposalExecuted`. */
export interface GovernorProposalExecutedEvent {
  readonly proposalId: bigint;
}

/** Decoded `ProofChainGovernor.ProposalCanceled`. */
export interface GovernorProposalCanceledEvent {
  readonly proposalId: bigint;
}

// ---------------------------------------------------------------------------
// ProposalRegistry event payload
// ---------------------------------------------------------------------------

/** Decoded `ProposalRegistry.ProposalDescribed`. */
export interface ProposalDescribedEvent {
  readonly proposalId: bigint;
  readonly uri: string;
  readonly author: Address;
}

// ---------------------------------------------------------------------------
// DisputeArbitration event payloads
// ---------------------------------------------------------------------------

/** Decoded `DisputeArbitration.DisputeOpened`. */
export interface DisputeOpenedEvent {
  readonly batchId: Bytes32;
  readonly opener: Address;
}

/** Decoded `DisputeArbitration.Voted`. */
export interface DisputeVotedEvent {
  readonly batchId: Bytes32;
  readonly arbiter: Address;
  readonly refundBuyer: boolean;
}

/** Decoded `DisputeArbitration.Resolved`. */
export interface DisputeResolvedEvent {
  readonly batchId: Bytes32;
  readonly refundedBuyer: boolean;
}

/** Decoded `DisputeArbitration.ArbiterSlashed`. */
export interface ArbiterSlashedEvent {
  readonly batchId: Bytes32;
  readonly arbiter: Address;
  readonly amount: bigint;
}

/** Decoded `DisputeArbitration.VotingPeriodUpdated`. */
export interface DisputeVotingPeriodUpdatedEvent {
  readonly oldPeriod: bigint;
  readonly newPeriod: bigint;
}

/** Decoded `DisputeArbitration.SlashPenaltyUpdated`. */
export interface DisputeSlashPenaltyUpdatedEvent {
  readonly oldPenalty: bigint;
  readonly newPenalty: bigint;
}

// ---------------------------------------------------------------------------
// ArbiterStaking event payloads
// ---------------------------------------------------------------------------

/** Decoded `ArbiterStaking.ArbiterStaked`. */
export interface ArbiterStakedEvent {
  readonly arbiter: Address;
  readonly amount: bigint;
}

/** Decoded `ArbiterStaking.ArbiterUnstaked`. */
export interface ArbiterUnstakedEvent {
  readonly arbiter: Address;
  readonly amount: bigint;
}

/** Decoded `ArbiterStaking.MinStakeUpdated`. */
export interface ArbiterMinStakeUpdatedEvent {
  readonly minStake: bigint;
}

// ---------------------------------------------------------------------------
// GovernanceToken event payload
// ---------------------------------------------------------------------------

/** Decoded `GovernanceToken.Minted`. */
export interface GovernanceMintedEvent {
  readonly to: Address;
  readonly amount: bigint;
}

// ---------------------------------------------------------------------------
// Request / response DTOs (api + web boundary)
//
// Big integers cross the JSON boundary as decimal strings; the decoders/schemas
// accept either a `bigint` or a numeric string, so the DTOs type the string
// form used over the wire.
// ---------------------------------------------------------------------------

/** Body for opening a dispute over a `Disputed` escrow deal. */
export interface OpenDisputeRequest {
  readonly batchId: Bytes32;
}

/** Body for casting an arbiter vote on an open dispute. */
export interface CastArbiterVoteRequest {
  readonly batchId: Bytes32;
  readonly refundBuyer: boolean;
}

/** Body for attaching a metadata URI to a governor proposal. */
export interface DescribeProposalRequest {
  readonly proposalId: string;
  readonly uri: string;
}

/** Body for committing (or un-committing) arbiter stake. */
export interface ArbiterStakeRequest {
  readonly amount: string;
}

/** Read model for a dispute, enriched with a human label and derived tallies. */
export interface DisputeView {
  readonly dispute: Dispute;
  readonly state: DisputeState;
  readonly stateLabel: string;
  readonly totalVotes: bigint;
  readonly resolved: boolean;
}

/** Read model for a governor proposal, merging on-chain state with off-chain metadata. */
export interface ProposalSummary {
  readonly proposalId: string;
  readonly state: ProposalState;
  readonly stateLabel: string;
  readonly proposer?: Address;
  readonly description?: string;
  readonly metadataURI?: string;
  readonly author?: Address;
  readonly voteStart?: bigint;
  readonly voteEnd?: bigint;
}

/** Read model for an arbiter's staking position. */
export interface ArbiterView {
  readonly account: Address;
  readonly stake: bigint;
  readonly isArbiter: boolean;
  readonly pendingVotes: bigint;
}
