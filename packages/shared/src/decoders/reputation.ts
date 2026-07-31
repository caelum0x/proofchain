/**
 * `reputation` domain event decoders.
 *
 * Decode raw EVM logs from the reputation engine, score oracle, supplier bond,
 * generic stake manager, and slashing controller against their exact ABIs, then
 * validate and normalize the viem args into the branded payload types from
 * `../types/reputation`. uint16 bps fields are narrowed to `number`; uint256
 * token amounts stay `bigint`.
 *
 * Convention (mirrors `./core`): return `null` when the log is not the expected
 * event; throw `ValidationError` when the event matches but its args are
 * malformed. Re-exported by `./index.ts`.
 */
import { z } from "zod";

import { AddressSchema, Bytes32Schema } from "../types";
import type {
  BondLockArgs,
  BondMovementArgs,
  BondSlashedArgs,
  GradeParamsUpdatedArgs,
  OutcomeRecordedArgs,
  ReputationEvent,
  SlashedArgs,
  StakeLockArgs,
  StakeMovementArgs,
  StakeSlashedArgs,
} from "../types/reputation";
import { ValidationError } from "../errors";
import { decodeContractEvent, parseRawEventLog } from "./core";

// ---------------------------------------------------------------------------
// Reusable arg-field schemas
// ---------------------------------------------------------------------------

const bytes32 = Bytes32Schema.transform((v) => v as `0x${string}`);
const address = AddressSchema;
const bigintArg = z.bigint();
const uint16Arg = z
  .union([z.bigint(), z.number()])
  .transform((v) => Number(v));

function parseArgs<S extends z.ZodTypeAny>(
  schema: S,
  args: Readonly<Record<string, unknown>>,
): z.infer<S> {
  const result = schema.safeParse(args);
  if (!result.success) {
    throw new ValidationError(
      "Malformed reputation event args",
      result.error.flatten(),
    );
  }
  return Object.freeze(result.data);
}

// ---------------------------------------------------------------------------
// Per-event zod schemas
// ---------------------------------------------------------------------------

const outcomeRecordedSchema = z.object({
  supplier: address,
  passed: z.boolean(),
  score: uint16Arg,
  newAvgScoreBps: uint16Arg,
});

const gradeParamsUpdatedSchema = z.object({
  reputationWeightBps: uint16Arg,
  kycWeightBps: uint16Arg,
});

const slashedSchema = z.object({
  who: address,
  amount: bigintArg,
  reason: bytes32,
  to: address,
});

const bondMovementSchema = z.object({
  supplier: address,
  token: address,
  amount: bigintArg,
});

const bondLockSchema = z.object({
  supplier: address,
  amount: bigintArg,
});

const bondSlashedSchema = z.object({
  supplier: address,
  amount: bigintArg,
  to: address,
});

const stakeMovementSchema = z.object({
  account: address,
  token: address,
  amount: bigintArg,
});

const stakeLockSchema = z.object({
  account: address,
  amount: bigintArg,
});

const stakeSlashedSchema = z.object({
  account: address,
  amount: bigintArg,
  to: address,
});

// ---------------------------------------------------------------------------
// Single-event decoders
// ---------------------------------------------------------------------------

/** Decode a `ReputationEngine.OutcomeRecorded` log, or `null`. */
export function decodeOutcomeRecorded(log: unknown): OutcomeRecordedArgs | null {
  const ev = decodeContractEvent("ReputationEngine", log);
  if (ev === null || ev.eventName !== "OutcomeRecorded") return null;
  return parseArgs(outcomeRecordedSchema, ev.args);
}

/** Decode a `ScoreOracle.GradeParamsUpdated` log, or `null`. */
export function decodeGradeParamsUpdated(
  log: unknown,
): GradeParamsUpdatedArgs | null {
  const ev = decodeContractEvent("ScoreOracle", log);
  if (ev === null || ev.eventName !== "GradeParamsUpdated") return null;
  return parseArgs(gradeParamsUpdatedSchema, ev.args);
}

/** Decode a `SlashingController.Slashed` log, or `null`. */
export function decodeSlashed(log: unknown): SlashedArgs | null {
  const ev = decodeContractEvent("SlashingController", log);
  if (ev === null || ev.eventName !== "Slashed") return null;
  return parseArgs(slashedSchema, ev.args);
}

/**
 * Decode a `SupplierBond.BondDeposited` or `BondWithdrawn` log (both share a
 * shape), or `null`.
 */
export function decodeBondMovement(log: unknown): BondMovementArgs | null {
  const ev = decodeContractEvent("SupplierBond", log);
  if (
    ev === null ||
    (ev.eventName !== "BondDeposited" && ev.eventName !== "BondWithdrawn")
  ) {
    return null;
  }
  return parseArgs(bondMovementSchema, ev.args);
}

/** Decode a `SupplierBond.BondSlashed` log, or `null`. */
export function decodeBondSlashed(log: unknown): BondSlashedArgs | null {
  const ev = decodeContractEvent("SupplierBond", log);
  if (ev === null || ev.eventName !== "BondSlashed") return null;
  return parseArgs(bondSlashedSchema, ev.args);
}

/**
 * Decode a `SupplierBond.BondLocked` or `BondUnlocked` log (both share a
 * shape), or `null`.
 */
export function decodeBondLock(log: unknown): BondLockArgs | null {
  const ev = decodeContractEvent("SupplierBond", log);
  if (
    ev === null ||
    (ev.eventName !== "BondLocked" && ev.eventName !== "BondUnlocked")
  ) {
    return null;
  }
  return parseArgs(bondLockSchema, ev.args);
}

/**
 * Decode a `StakeManager.Staked` or `Unstaked` log (both share a shape), or
 * `null`.
 */
export function decodeStakeMovement(log: unknown): StakeMovementArgs | null {
  const ev = decodeContractEvent("StakeManager", log);
  if (
    ev === null ||
    (ev.eventName !== "Staked" && ev.eventName !== "Unstaked")
  ) {
    return null;
  }
  return parseArgs(stakeMovementSchema, ev.args);
}

/**
 * Decode a `StakeManager.Locked` or `Unlocked` log (both share a shape), or
 * `null`.
 */
export function decodeStakeLock(log: unknown): StakeLockArgs | null {
  const ev = decodeContractEvent("StakeManager", log);
  if (
    ev === null ||
    (ev.eventName !== "Locked" && ev.eventName !== "Unlocked")
  ) {
    return null;
  }
  return parseArgs(stakeLockSchema, ev.args);
}

/** Decode a `StakeManager.StakeSlashed` log, or `null`. */
export function decodeStakeSlashed(log: unknown): StakeSlashedArgs | null {
  const ev = decodeContractEvent("StakeManager", log);
  if (ev === null || ev.eventName !== "StakeSlashed") return null;
  return parseArgs(stakeSlashedSchema, ev.args);
}

// ---------------------------------------------------------------------------
// Aggregate decoder
// ---------------------------------------------------------------------------

/**
 * Decode a log into the tagged {@link ReputationEvent} union, trying every
 * reputation-domain contract in turn. Returns `null` when the log is not a
 * recognized event. Throws `ValidationError` on structurally invalid input.
 */
export function decodeReputationEvent(log: unknown): ReputationEvent | null {
  const raw = parseRawEventLog(log);

  const re = decodeContractEvent("ReputationEngine", raw);
  if (re !== null && re.eventName === "OutcomeRecorded") {
    return { contract: "ReputationEngine", eventName: "OutcomeRecorded", args: parseArgs(outcomeRecordedSchema, re.args) };
  }

  const so = decodeContractEvent("ScoreOracle", raw);
  if (so !== null && so.eventName === "GradeParamsUpdated") {
    return { contract: "ScoreOracle", eventName: "GradeParamsUpdated", args: parseArgs(gradeParamsUpdatedSchema, so.args) };
  }

  const sc = decodeContractEvent("SlashingController", raw);
  if (sc !== null && sc.eventName === "Slashed") {
    return { contract: "SlashingController", eventName: "Slashed", args: parseArgs(slashedSchema, sc.args) };
  }

  const sb = decodeContractEvent("SupplierBond", raw);
  if (sb !== null) {
    if (sb.eventName === "BondDeposited") {
      return { contract: "SupplierBond", eventName: "BondDeposited", args: parseArgs(bondMovementSchema, sb.args) };
    }
    if (sb.eventName === "BondWithdrawn") {
      return { contract: "SupplierBond", eventName: "BondWithdrawn", args: parseArgs(bondMovementSchema, sb.args) };
    }
    if (sb.eventName === "BondLocked") {
      return { contract: "SupplierBond", eventName: "BondLocked", args: parseArgs(bondLockSchema, sb.args) };
    }
    if (sb.eventName === "BondUnlocked") {
      return { contract: "SupplierBond", eventName: "BondUnlocked", args: parseArgs(bondLockSchema, sb.args) };
    }
    if (sb.eventName === "BondSlashed") {
      return { contract: "SupplierBond", eventName: "BondSlashed", args: parseArgs(bondSlashedSchema, sb.args) };
    }
  }

  const sm = decodeContractEvent("StakeManager", raw);
  if (sm !== null) {
    if (sm.eventName === "Staked") {
      return { contract: "StakeManager", eventName: "Staked", args: parseArgs(stakeMovementSchema, sm.args) };
    }
    if (sm.eventName === "Unstaked") {
      return { contract: "StakeManager", eventName: "Unstaked", args: parseArgs(stakeMovementSchema, sm.args) };
    }
    if (sm.eventName === "Locked") {
      return { contract: "StakeManager", eventName: "Locked", args: parseArgs(stakeLockSchema, sm.args) };
    }
    if (sm.eventName === "Unlocked") {
      return { contract: "StakeManager", eventName: "Unlocked", args: parseArgs(stakeLockSchema, sm.args) };
    }
    if (sm.eventName === "StakeSlashed") {
      return { contract: "StakeManager", eventName: "StakeSlashed", args: parseArgs(stakeSlashedSchema, sm.args) };
    }
  }

  return null;
}
