/**
 * `reputation` domain types.
 *
 * The on-chain struct mirror and grade types for this domain (`Reputation`,
 * `RiskGrade`, `RISK_GRADE_LABELS`) live in `./core` and are re-exported from the
 * package root. This module adds:
 *
 *  - **Decoded-event payload types** — the typed shape each key reputation /
 *    bond / stake / slashing event normalizes to (produced by
 *    `../decoders/reputation`).
 *  - **Request / read-model DTOs** — request bodies and aggregate standing views
 *    the `api`/`web` packages exchange, plus zod schemas that validate them.
 *
 * Every field is `readonly`; `bigint` mirrors uint256 and `number` mirrors
 * uint16. Branded `Address` / `Bytes32` come from `./core`. On-chain token
 * amounts are `bigint` in decoded events and JSON-safe decimal strings in
 * request DTOs.
 *
 * Re-exported by `../types/index.ts`.
 */
import { z } from "zod";

import {
  AddressSchema,
  Bytes32Schema,
  ScoreBpsSchema,
  type Address,
  type Bytes32,
  type Reputation,
  type RiskGrade,
} from "./core";

// ---------------------------------------------------------------------------
// Local branded arg / value schemas
// ---------------------------------------------------------------------------

const bytes32 = Bytes32Schema as unknown as z.ZodType<Bytes32>;
const address = AddressSchema as unknown as z.ZodType<Address>;

/** A non-negative integer amount expressed as a base-10 string (JSON-safe wei). */
export const Uint256StringSchema = z
  .string()
  .regex(/^[0-9]+$/u, "Expected a base-10 unsigned integer string");

// ---------------------------------------------------------------------------
// Decoded event payloads
// ---------------------------------------------------------------------------

/** `ReputationEngine.OutcomeRecorded`. */
export interface OutcomeRecordedArgs {
  readonly supplier: Address;
  readonly passed: boolean;
  readonly score: number; // uint16 bps
  readonly newAvgScoreBps: number; // uint16 bps
}

/** `ScoreOracle.GradeParamsUpdated`. */
export interface GradeParamsUpdatedArgs {
  readonly reputationWeightBps: number; // uint16 bps
  readonly kycWeightBps: number; // uint16 bps
}

/** `SlashingController.Slashed`. */
export interface SlashedArgs {
  readonly who: Address;
  readonly amount: bigint; // uint256
  readonly reason: Bytes32;
  readonly to: Address;
}

/** `SupplierBond.BondDeposited` / `BondWithdrawn` (identical shape). */
export interface BondMovementArgs {
  readonly supplier: Address;
  readonly token: Address;
  readonly amount: bigint; // uint256
}

/** `SupplierBond.BondLocked` / `BondUnlocked` (identical shape). */
export interface BondLockArgs {
  readonly supplier: Address;
  readonly amount: bigint; // uint256
}

/** `SupplierBond.BondSlashed`. */
export interface BondSlashedArgs {
  readonly supplier: Address;
  readonly amount: bigint; // uint256
  readonly to: Address;
}

/** `StakeManager.Staked` / `Unstaked` (identical shape). */
export interface StakeMovementArgs {
  readonly account: Address;
  readonly token: Address;
  readonly amount: bigint; // uint256
}

/** `StakeManager.Locked` / `Unlocked` (identical shape). */
export interface StakeLockArgs {
  readonly account: Address;
  readonly amount: bigint; // uint256
}

/** `StakeManager.StakeSlashed`. */
export interface StakeSlashedArgs {
  readonly account: Address;
  readonly amount: bigint; // uint256
  readonly to: Address;
}

/**
 * Discriminated union of every decoded reputation-domain event, tagged by its
 * source contract and event name. Returned by `decodeReputationEvent`.
 */
export type ReputationEvent =
  | { readonly contract: "ReputationEngine"; readonly eventName: "OutcomeRecorded"; readonly args: OutcomeRecordedArgs }
  | { readonly contract: "ScoreOracle"; readonly eventName: "GradeParamsUpdated"; readonly args: GradeParamsUpdatedArgs }
  | { readonly contract: "SlashingController"; readonly eventName: "Slashed"; readonly args: SlashedArgs }
  | { readonly contract: "SupplierBond"; readonly eventName: "BondDeposited"; readonly args: BondMovementArgs }
  | { readonly contract: "SupplierBond"; readonly eventName: "BondWithdrawn"; readonly args: BondMovementArgs }
  | { readonly contract: "SupplierBond"; readonly eventName: "BondLocked"; readonly args: BondLockArgs }
  | { readonly contract: "SupplierBond"; readonly eventName: "BondUnlocked"; readonly args: BondLockArgs }
  | { readonly contract: "SupplierBond"; readonly eventName: "BondSlashed"; readonly args: BondSlashedArgs }
  | { readonly contract: "StakeManager"; readonly eventName: "Staked"; readonly args: StakeMovementArgs }
  | { readonly contract: "StakeManager"; readonly eventName: "Unstaked"; readonly args: StakeMovementArgs }
  | { readonly contract: "StakeManager"; readonly eventName: "Locked"; readonly args: StakeLockArgs }
  | { readonly contract: "StakeManager"; readonly eventName: "Unlocked"; readonly args: StakeLockArgs }
  | { readonly contract: "StakeManager"; readonly eventName: "StakeSlashed"; readonly args: StakeSlashedArgs };

/** All reputation-domain event names, useful for indexer topic filtering. */
export const REPUTATION_EVENT_NAMES = [
  "OutcomeRecorded",
  "GradeParamsUpdated",
  "Slashed",
  "BondDeposited",
  "BondWithdrawn",
  "BondLocked",
  "BondUnlocked",
  "BondSlashed",
  "Staked",
  "Unstaked",
  "Locked",
  "Unlocked",
  "StakeSlashed",
] as const;

export type ReputationEventName = (typeof REPUTATION_EVENT_NAMES)[number];

// ---------------------------------------------------------------------------
// Request DTOs (api/web → chain writes)
// ---------------------------------------------------------------------------

/** Body for `ReputationEngine.recordOutcome`. */
export interface RecordOutcomeRequest {
  readonly supplier: Address;
  readonly passed: boolean;
  readonly score: number;
}

export const RecordOutcomeRequestSchema: z.ZodType<RecordOutcomeRequest> = z.object({
  supplier: address,
  passed: z.boolean(),
  score: ScoreBpsSchema,
});

/** Body for `SlashingController.slash`. `amount` is a base-10 wei string. */
export interface SlashRequest {
  readonly who: Address;
  readonly amount: string;
  readonly reason: Bytes32;
}

export const SlashRequestSchema: z.ZodType<SlashRequest> = z.object({
  who: address,
  amount: Uint256StringSchema,
  reason: bytes32,
});

/**
 * Body for token-denominated stake/bond deposits and withdrawals
 * (`SupplierBond.depositBond|withdrawBond`, `StakeManager.stake|unstake`).
 * `amount` is a base-10 wei string.
 */
export interface StakeRequest {
  readonly token: Address;
  readonly amount: string;
}

export const StakeRequestSchema: z.ZodType<StakeRequest> = z.object({
  token: address,
  amount: Uint256StringSchema,
});

// ---------------------------------------------------------------------------
// Read-model DTOs (aggregate standing views for api/web)
// ---------------------------------------------------------------------------

/**
 * Aggregate risk/standing view for a supplier: reputation history, composite
 * grade, and posted bond / stake accounting.
 */
export interface ReputationSummary {
  readonly supplier: Address;
  readonly reputation: Reputation;
  readonly grade: RiskGrade;
  readonly gradeLabel: string;
  readonly bond: bigint;
  readonly lockedBond: bigint;
  readonly stake: bigint;
  readonly lockedStake: bigint;
}
