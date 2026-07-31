/**
 * `rewards` domain event decoders.
 *
 * viem-log decoders for the key incentive-layer events: the
 * {RewardsDistributor}, {LoyaltyPoints}, {ReferralProgram}, {StakingRewards},
 * and {EmissionsController}. Each helper decodes a raw log against exactly one
 * contract ABI, asserts the event name, validates the args with zod, and
 * normalizes them into the immutable, branded mirrors from `../types/rewards`.
 *
 * viem's `decodeEventLog` returns every integer as a `bigint`; these decoders
 * keep amounts / epochs / rates as `bigint`. Every helper throws
 * {@link ValidationError} on a non-matching or malformed log — no silent
 * coercion. Re-exported by `../decoders/index.ts`.
 */
import { z } from "zod";

import type { ContractName } from "../abis/index";
import { ValidationError } from "../errors";
import { AddressSchema, Bytes32Schema } from "../types";
import type {
  ConversionRecordedEvent,
  EmissionRateSetEvent,
  LoyaltyAwardedEvent,
  LoyaltyTransferabilityUpdatedEvent,
  ReferralClaimedEvent,
  ReferralRewardBpsUpdatedEvent,
  ReferredEvent,
  RewardClaimedEvent,
  RewardPaidEvent,
  RewardRateSyncedEvent,
  RewardRootSetEvent,
  RewardStakedEvent,
  RewardWithdrawnEvent,
} from "../types/rewards";
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

// ---------------------------------------------------------------------------
// RewardsDistributor
// ---------------------------------------------------------------------------

const RootSetSchema = z.object({ root: Bytes32Schema, epoch: BigIntLike });

export function decodeRewardRootSet(log: unknown): RewardRootSetEvent {
  const a = parseArgs(
    RootSetSchema,
    eventArgs("RewardsDistributor", "RootSet", log),
    "RootSet",
  );
  return Object.freeze({ root: a.root as `0x${string}`, epoch: a.epoch });
}

const RewardClaimedSchema = z.object({
  account: AddressSchema,
  epoch: BigIntLike,
  amount: BigIntLike,
});

export function decodeRewardClaimed(log: unknown): RewardClaimedEvent {
  const a = parseArgs(
    RewardClaimedSchema,
    eventArgs("RewardsDistributor", "Claimed", log),
    "Claimed",
  );
  return Object.freeze({
    account: a.account,
    epoch: a.epoch,
    amount: a.amount,
  });
}

// ---------------------------------------------------------------------------
// LoyaltyPoints
// ---------------------------------------------------------------------------

const AwardedSchema = z.object({ to: AddressSchema, amount: BigIntLike });

export function decodeLoyaltyAwarded(log: unknown): LoyaltyAwardedEvent {
  const a = parseArgs(
    AwardedSchema,
    eventArgs("LoyaltyPoints", "Awarded", log),
    "Awarded",
  );
  return Object.freeze({ to: a.to, amount: a.amount });
}

const TransferabilityUpdatedSchema = z.object({ transferable: z.boolean() });

export function decodeLoyaltyTransferabilityUpdated(
  log: unknown,
): LoyaltyTransferabilityUpdatedEvent {
  const a = parseArgs(
    TransferabilityUpdatedSchema,
    eventArgs("LoyaltyPoints", "TransferabilityUpdated", log),
    "TransferabilityUpdated",
  );
  return Object.freeze({ transferable: a.transferable });
}

// ---------------------------------------------------------------------------
// ReferralProgram
// ---------------------------------------------------------------------------

const ReferredSchema = z.object({
  referrer: AddressSchema,
  referee: AddressSchema,
});

export function decodeReferred(log: unknown): ReferredEvent {
  const a = parseArgs(
    ReferredSchema,
    eventArgs("ReferralProgram", "Referred", log),
    "Referred",
  );
  return Object.freeze({ referrer: a.referrer, referee: a.referee });
}

const ConversionRecordedSchema = z.object({
  referee: AddressSchema,
  value: BigIntLike,
  reward: BigIntLike,
});

export function decodeConversionRecorded(
  log: unknown,
): ConversionRecordedEvent {
  const a = parseArgs(
    ConversionRecordedSchema,
    eventArgs("ReferralProgram", "ConversionRecorded", log),
    "ConversionRecorded",
  );
  return Object.freeze({
    referee: a.referee,
    value: a.value,
    reward: a.reward,
  });
}

const ReferralClaimedSchema = z.object({
  referrer: AddressSchema,
  amount: BigIntLike,
});

export function decodeReferralClaimed(log: unknown): ReferralClaimedEvent {
  const a = parseArgs(
    ReferralClaimedSchema,
    eventArgs("ReferralProgram", "ReferralClaimed", log),
    "ReferralClaimed",
  );
  return Object.freeze({ referrer: a.referrer, amount: a.amount });
}

const RewardBpsUpdatedSchema = z.object({
  oldBps: BigIntLike,
  newBps: BigIntLike,
});

export function decodeReferralRewardBpsUpdated(
  log: unknown,
): ReferralRewardBpsUpdatedEvent {
  const a = parseArgs(
    RewardBpsUpdatedSchema,
    eventArgs("ReferralProgram", "RewardBpsUpdated", log),
    "RewardBpsUpdated",
  );
  return Object.freeze({ oldBps: a.oldBps, newBps: a.newBps });
}

// ---------------------------------------------------------------------------
// StakingRewards
// ---------------------------------------------------------------------------

const StakeChangeSchema = z.object({
  account: AddressSchema,
  amount: BigIntLike,
});

export function decodeRewardStaked(log: unknown): RewardStakedEvent {
  const a = parseArgs(
    StakeChangeSchema,
    eventArgs("StakingRewards", "Staked", log),
    "Staked",
  );
  return Object.freeze({ account: a.account, amount: a.amount });
}

export function decodeRewardWithdrawn(log: unknown): RewardWithdrawnEvent {
  const a = parseArgs(
    StakeChangeSchema,
    eventArgs("StakingRewards", "Withdrawn", log),
    "Withdrawn",
  );
  return Object.freeze({ account: a.account, amount: a.amount });
}

const RewardPaidSchema = z.object({
  account: AddressSchema,
  reward: BigIntLike,
});

export function decodeRewardPaid(log: unknown): RewardPaidEvent {
  const a = parseArgs(
    RewardPaidSchema,
    eventArgs("StakingRewards", "RewardPaid", log),
    "RewardPaid",
  );
  return Object.freeze({ account: a.account, reward: a.reward });
}

const RewardRateSyncedSchema = z.object({ rate: BigIntLike });

export function decodeRewardRateSynced(log: unknown): RewardRateSyncedEvent {
  const a = parseArgs(
    RewardRateSyncedSchema,
    eventArgs("StakingRewards", "RewardRateSynced", log),
    "RewardRateSynced",
  );
  return Object.freeze({ rate: a.rate });
}

// ---------------------------------------------------------------------------
// EmissionsController
// ---------------------------------------------------------------------------

const EmissionRateSetSchema = z.object({
  epoch: BigIntLike,
  rate: BigIntLike,
});

export function decodeEmissionRateSet(log: unknown): EmissionRateSetEvent {
  const a = parseArgs(
    EmissionRateSetSchema,
    eventArgs("EmissionsController", "EmissionRateSet", log),
    "EmissionRateSet",
  );
  return Object.freeze({ epoch: a.epoch, rate: a.rate });
}
