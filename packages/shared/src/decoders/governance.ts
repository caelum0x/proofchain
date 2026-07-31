/**
 * `governance` domain event decoders.
 *
 * viem-log decoders for the key governance events: the OZ {ProofChainGovernor}
 * lifecycle, the {ProposalRegistry}, staked-arbiter {DisputeArbitration} +
 * {ArbiterStaking}, and the {GovernanceToken} mint. Each helper decodes a raw
 * log against exactly one contract ABI, asserts the event name, validates the
 * args with zod, and normalizes them into the immutable, branded mirrors from
 * `../types/governance`.
 *
 * viem's `decodeEventLog` returns every integer (uint8/48/64/256) as a
 * `bigint`; these decoders keep amounts/timestamps as `bigint` and narrow the
 * `support` enum through the shared, validated {@link decodeEnum}. Every helper
 * throws {@link ValidationError} on a non-matching or malformed log — no silent
 * coercion. Re-exported by `../decoders/index.ts`.
 */
import { z } from "zod";

import type { ContractName } from "../abis/index";
import { ValidationError } from "../errors";
import { decodeEnum } from "../structs";
import { AddressSchema, Bytes32Schema, HexSchema, GovernorVoteType } from "../types";
import type {
  ArbiterMinStakeUpdatedEvent,
  ArbiterSlashedEvent,
  ArbiterStakedEvent,
  ArbiterUnstakedEvent,
  DisputeOpenedEvent,
  DisputeResolvedEvent,
  DisputeSlashPenaltyUpdatedEvent,
  DisputeVotedEvent,
  DisputeVotingPeriodUpdatedEvent,
  GovernanceMintedEvent,
  GovernorProposalCanceledEvent,
  GovernorProposalCreatedEvent,
  GovernorProposalExecutedEvent,
  GovernorProposalQueuedEvent,
  GovernorVoteCastEvent,
  ProposalDescribedEvent,
} from "../types/governance";
import { decodeContractEvent } from "./core";

// ---------------------------------------------------------------------------
// Shared arg coercions + event dispatch
// ---------------------------------------------------------------------------

/** Accepts a `bigint`, safe integer, or decimal string and yields a `bigint`. */
const BigIntLike = z.preprocess((v) => {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isInteger(v)) return BigInt(v);
  if (typeof v === "string" && /^\d+$/u.test(v)) return BigInt(v);
  return v;
}, z.bigint().nonnegative("Value must be non-negative"));

/** Accepts a `bigint`, safe integer, or decimal string and yields a `number` (small enums). */
const NumberLike = z.preprocess((v) => {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  if (typeof v === "string" && /^\d+$/u.test(v)) return Number(v);
  return v;
}, z.number().int("Expected an integer").nonnegative("Value must be >= 0"));

/**
 * Decode `log` against `contract`'s ABI and assert it is the `eventName` event,
 * returning its raw args. Throws {@link ValidationError} when the log does not
 * decode against the contract or decodes to a different event.
 */
function eventArgs(
  contract: ContractName,
  eventName: string,
  log: unknown,
): Readonly<Record<string, unknown>> {
  const decoded = decodeContractEvent(contract, log);
  if (decoded === null) {
    throw new ValidationError(`Log does not match any ${contract} event`, {
      contract,
      expected: eventName,
    });
  }
  if (decoded.eventName !== eventName) {
    throw new ValidationError(
      `Expected ${contract}.${eventName} but decoded ${decoded.eventName}`,
      { contract, expected: eventName, actual: decoded.eventName },
    );
  }
  return decoded.args;
}

/** Parse raw args with `schema`, re-wrapping Zod failures as {@link ValidationError}. */
function parseArgs<S extends z.ZodTypeAny>(
  schema: S,
  args: unknown,
  eventName: string,
): z.infer<S> {
  const result = schema.safeParse(args);
  if (!result.success) {
    throw new ValidationError(
      `Invalid ${eventName} event args`,
      result.error.flatten(),
    );
  }
  return result.data;
}

const GovernorVoteTypeValues = [
  GovernorVoteType.Against,
  GovernorVoteType.For,
  GovernorVoteType.Abstain,
] as const;

// ---------------------------------------------------------------------------
// ProofChainGovernor
// ---------------------------------------------------------------------------

const ProposalCreatedSchema = z.object({
  proposalId: BigIntLike,
  proposer: AddressSchema,
  targets: z.array(AddressSchema),
  values: z.array(BigIntLike),
  signatures: z.array(z.string()),
  calldatas: z.array(HexSchema),
  voteStart: BigIntLike,
  voteEnd: BigIntLike,
  description: z.string(),
});

export function decodeProposalCreated(log: unknown): GovernorProposalCreatedEvent {
  const a = parseArgs(
    ProposalCreatedSchema,
    eventArgs("ProofChainGovernor", "ProposalCreated", log),
    "ProposalCreated",
  );
  return Object.freeze({
    proposalId: a.proposalId,
    proposer: a.proposer,
    targets: Object.freeze([...a.targets]),
    values: Object.freeze([...a.values]),
    signatures: Object.freeze([...a.signatures]),
    calldatas: Object.freeze(a.calldatas.map((c) => c as `0x${string}`)),
    voteStart: a.voteStart,
    voteEnd: a.voteEnd,
    description: a.description,
  });
}

const VoteCastSchema = z.object({
  voter: AddressSchema,
  proposalId: BigIntLike,
  support: NumberLike,
  weight: BigIntLike,
  reason: z.string(),
});

export function decodeVoteCast(log: unknown): GovernorVoteCastEvent {
  const a = parseArgs(
    VoteCastSchema,
    eventArgs("ProofChainGovernor", "VoteCast", log),
    "VoteCast",
  );
  return Object.freeze({
    voter: a.voter,
    proposalId: a.proposalId,
    support: decodeEnum("GovernorVoteType", GovernorVoteTypeValues, a.support),
    weight: a.weight,
    reason: a.reason,
  });
}

const ProposalQueuedSchema = z.object({
  proposalId: BigIntLike,
  etaSeconds: BigIntLike,
});

export function decodeProposalQueued(log: unknown): GovernorProposalQueuedEvent {
  const a = parseArgs(
    ProposalQueuedSchema,
    eventArgs("ProofChainGovernor", "ProposalQueued", log),
    "ProposalQueued",
  );
  return Object.freeze({ proposalId: a.proposalId, etaSeconds: a.etaSeconds });
}

const ProposalIdOnlySchema = z.object({ proposalId: BigIntLike });

export function decodeProposalExecuted(
  log: unknown,
): GovernorProposalExecutedEvent {
  const a = parseArgs(
    ProposalIdOnlySchema,
    eventArgs("ProofChainGovernor", "ProposalExecuted", log),
    "ProposalExecuted",
  );
  return Object.freeze({ proposalId: a.proposalId });
}

export function decodeProposalCanceled(
  log: unknown,
): GovernorProposalCanceledEvent {
  const a = parseArgs(
    ProposalIdOnlySchema,
    eventArgs("ProofChainGovernor", "ProposalCanceled", log),
    "ProposalCanceled",
  );
  return Object.freeze({ proposalId: a.proposalId });
}

// ---------------------------------------------------------------------------
// ProposalRegistry
// ---------------------------------------------------------------------------

const ProposalDescribedSchema = z.object({
  proposalId: BigIntLike,
  uri: z.string(),
  author: AddressSchema,
});

export function decodeProposalDescribed(log: unknown): ProposalDescribedEvent {
  const a = parseArgs(
    ProposalDescribedSchema,
    eventArgs("ProposalRegistry", "ProposalDescribed", log),
    "ProposalDescribed",
  );
  return Object.freeze({
    proposalId: a.proposalId,
    uri: a.uri,
    author: a.author,
  });
}

// ---------------------------------------------------------------------------
// DisputeArbitration
// ---------------------------------------------------------------------------

const DisputeOpenedSchema = z.object({
  batchId: Bytes32Schema,
  opener: AddressSchema,
});

export function decodeDisputeOpened(log: unknown): DisputeOpenedEvent {
  const a = parseArgs(
    DisputeOpenedSchema,
    eventArgs("DisputeArbitration", "DisputeOpened", log),
    "DisputeOpened",
  );
  return Object.freeze({ batchId: a.batchId as `0x${string}`, opener: a.opener });
}

const VotedSchema = z.object({
  batchId: Bytes32Schema,
  arbiter: AddressSchema,
  refundBuyer: z.boolean(),
});

export function decodeDisputeVoted(log: unknown): DisputeVotedEvent {
  const a = parseArgs(
    VotedSchema,
    eventArgs("DisputeArbitration", "Voted", log),
    "Voted",
  );
  return Object.freeze({
    batchId: a.batchId as `0x${string}`,
    arbiter: a.arbiter,
    refundBuyer: a.refundBuyer,
  });
}

const ResolvedSchema = z.object({
  batchId: Bytes32Schema,
  refundedBuyer: z.boolean(),
});

export function decodeDisputeResolved(log: unknown): DisputeResolvedEvent {
  const a = parseArgs(
    ResolvedSchema,
    eventArgs("DisputeArbitration", "Resolved", log),
    "Resolved",
  );
  return Object.freeze({
    batchId: a.batchId as `0x${string}`,
    refundedBuyer: a.refundedBuyer,
  });
}

const ArbiterSlashedSchema = z.object({
  batchId: Bytes32Schema,
  arbiter: AddressSchema,
  amount: BigIntLike,
});

export function decodeArbiterSlashed(log: unknown): ArbiterSlashedEvent {
  const a = parseArgs(
    ArbiterSlashedSchema,
    eventArgs("DisputeArbitration", "ArbiterSlashed", log),
    "ArbiterSlashed",
  );
  return Object.freeze({
    batchId: a.batchId as `0x${string}`,
    arbiter: a.arbiter,
    amount: a.amount,
  });
}

const VotingPeriodUpdatedSchema = z.object({
  oldPeriod: BigIntLike,
  newPeriod: BigIntLike,
});

export function decodeDisputeVotingPeriodUpdated(
  log: unknown,
): DisputeVotingPeriodUpdatedEvent {
  const a = parseArgs(
    VotingPeriodUpdatedSchema,
    eventArgs("DisputeArbitration", "VotingPeriodUpdated", log),
    "VotingPeriodUpdated",
  );
  return Object.freeze({ oldPeriod: a.oldPeriod, newPeriod: a.newPeriod });
}

const SlashPenaltyUpdatedSchema = z.object({
  oldPenalty: BigIntLike,
  newPenalty: BigIntLike,
});

export function decodeDisputeSlashPenaltyUpdated(
  log: unknown,
): DisputeSlashPenaltyUpdatedEvent {
  const a = parseArgs(
    SlashPenaltyUpdatedSchema,
    eventArgs("DisputeArbitration", "SlashPenaltyUpdated", log),
    "SlashPenaltyUpdated",
  );
  return Object.freeze({ oldPenalty: a.oldPenalty, newPenalty: a.newPenalty });
}

// ---------------------------------------------------------------------------
// ArbiterStaking
// ---------------------------------------------------------------------------

const ArbiterStakeChangeSchema = z.object({
  arbiter: AddressSchema,
  amount: BigIntLike,
});

export function decodeArbiterStaked(log: unknown): ArbiterStakedEvent {
  const a = parseArgs(
    ArbiterStakeChangeSchema,
    eventArgs("ArbiterStaking", "ArbiterStaked", log),
    "ArbiterStaked",
  );
  return Object.freeze({ arbiter: a.arbiter, amount: a.amount });
}

export function decodeArbiterUnstaked(log: unknown): ArbiterUnstakedEvent {
  const a = parseArgs(
    ArbiterStakeChangeSchema,
    eventArgs("ArbiterStaking", "ArbiterUnstaked", log),
    "ArbiterUnstaked",
  );
  return Object.freeze({ arbiter: a.arbiter, amount: a.amount });
}

const MinStakeUpdatedSchema = z.object({ minStake: BigIntLike });

export function decodeArbiterMinStakeUpdated(
  log: unknown,
): ArbiterMinStakeUpdatedEvent {
  const a = parseArgs(
    MinStakeUpdatedSchema,
    eventArgs("ArbiterStaking", "MinStakeUpdated", log),
    "MinStakeUpdated",
  );
  return Object.freeze({ minStake: a.minStake });
}

// ---------------------------------------------------------------------------
// GovernanceToken
// ---------------------------------------------------------------------------

const MintedSchema = z.object({ to: AddressSchema, amount: BigIntLike });

export function decodeGovernanceMinted(log: unknown): GovernanceMintedEvent {
  const a = parseArgs(
    MintedSchema,
    eventArgs("GovernanceToken", "Minted", log),
    "Minted",
  );
  return Object.freeze({ to: a.to, amount: a.amount });
}
