/**
 * `insurance` domain types — policies, claims, capital & risk pools.
 *
 * The core on-chain struct mirrors and status enums (`Policy`, `PolicyState`,
 * `Claim`, `ClaimState`) live in `./core` and are re-exported from the package
 * root. This module adds the decoded-event payloads for the policy/claims/pool
 * contracts, the premium-quote view DTO, and the request DTOs the api/web use.
 *
 * Field typing rules (match viem's decoded output): `bigint` for uint256/uint64,
 * `number` for uint8/uint16, branded `Address`/`Bytes32` for addresses/hashes.
 * Every field is `readonly`.
 *
 * Re-exported by `../types/index.ts`.
 */
import type { Address, Bytes32 } from "./core";

// ---------------------------------------------------------------------------
// PolicyManager events
// ---------------------------------------------------------------------------

/** `PolicyManager.PolicyIssued(policyId, batchId, holder, coverage, premium)`. */
export interface PolicyIssuedEvent {
  readonly eventName: "PolicyIssued";
  readonly policyId: Bytes32;
  readonly batchId: Bytes32;
  readonly holder: Address;
  readonly coverage: bigint;
  readonly premium: bigint;
}

/** `PolicyManager.PolicyCancelled(policyId)`. */
export interface PolicyCancelledEvent {
  readonly eventName: "PolicyCancelled";
  readonly policyId: Bytes32;
}

// ---------------------------------------------------------------------------
// ClaimsProcessor events
// ---------------------------------------------------------------------------

/** `ClaimsProcessor.ClaimFiled(claimId, policyId, claimant, amount)`. */
export interface ClaimFiledEvent {
  readonly eventName: "ClaimFiled";
  readonly claimId: Bytes32;
  readonly policyId: Bytes32;
  readonly claimant: Address;
  readonly amount: bigint;
}

/** `ClaimsProcessor.ClaimApproved(claimId, arbiter)`. */
export interface ClaimApprovedEvent {
  readonly eventName: "ClaimApproved";
  readonly claimId: Bytes32;
  readonly arbiter: Address;
}

/** `ClaimsProcessor.ClaimRejected(claimId, arbiter)`. */
export interface ClaimRejectedEvent {
  readonly eventName: "ClaimRejected";
  readonly claimId: Bytes32;
  readonly arbiter: Address;
}

/** `ClaimsProcessor.ClaimPaid(claimId, to, amount)`. */
export interface ClaimPaidEvent {
  readonly eventName: "ClaimPaid";
  readonly claimId: Bytes32;
  readonly to: Address;
  readonly amount: bigint;
}

// ---------------------------------------------------------------------------
// InsurancePool / RiskPool events
// ---------------------------------------------------------------------------

/** `InsurancePool.Underwritten(policyId, coverage)`. */
export interface UnderwrittenEvent {
  readonly eventName: "Underwritten";
  readonly policyId: Bytes32;
  readonly coverage: bigint;
}

/** `InsurancePool.Deposited(provider, token, amount)`. */
export interface PoolCapitalDepositedEvent {
  readonly eventName: "Deposited";
  readonly provider: Address;
  readonly token: Address;
  readonly amount: bigint;
}

/** `InsurancePool.Withdrawn(provider, token, amount)`. */
export interface PoolCapitalWithdrawnEvent {
  readonly eventName: "Withdrawn";
  readonly provider: Address;
  readonly token: Address;
  readonly amount: bigint;
}

/** `InsurancePool.PaidOut(policyId, to, amount)`. */
export interface PoolPaidOutEvent {
  readonly eventName: "PaidOut";
  readonly policyId: Bytes32;
  readonly to: Address;
  readonly amount: bigint;
}

/** `RiskPool.ToppedUp(from, token, amount)`. */
export interface RiskPoolToppedUpEvent {
  readonly eventName: "ToppedUp";
  readonly from: Address;
  readonly token: Address;
  readonly amount: bigint;
}

/** `RiskPool.Covered(policyId, to, amount)`. */
export interface RiskPoolCoveredEvent {
  readonly eventName: "Covered";
  readonly policyId: Bytes32;
  readonly to: Address;
  readonly amount: bigint;
}

/** Ordered tuple of every decodable insurance event name. */
export const INSURANCE_EVENT_NAMES = [
  "PolicyIssued",
  "PolicyCancelled",
  "ClaimFiled",
  "ClaimApproved",
  "ClaimRejected",
  "ClaimPaid",
  "Underwritten",
  "Deposited",
  "Withdrawn",
  "PaidOut",
  "ToppedUp",
  "Covered",
] as const;

export type InsuranceEventName = (typeof INSURANCE_EVENT_NAMES)[number];

/** Discriminated union of every decoded insurance event payload. */
export type InsuranceDomainEvent =
  | PolicyIssuedEvent
  | PolicyCancelledEvent
  | ClaimFiledEvent
  | ClaimApprovedEvent
  | ClaimRejectedEvent
  | ClaimPaidEvent
  | UnderwrittenEvent
  | PoolCapitalDepositedEvent
  | PoolCapitalWithdrawnEvent
  | PoolPaidOutEvent
  | RiskPoolToppedUpEvent
  | RiskPoolCoveredEvent;

// ---------------------------------------------------------------------------
// View DTOs
// ---------------------------------------------------------------------------

/** Result of `PremiumCalculator.premiumFor` / `premiumBps` for coverage. */
export interface PremiumQuote {
  readonly coverage: bigint;
  readonly grade: number; // uint8 risk grade (1 best .. 7 worst)
  readonly premium: bigint;
  readonly premiumBps: number; // uint16 basis points
}

/** Capital snapshot of the `InsurancePool` for a token. */
export interface InsurancePoolInfo {
  readonly token: Address;
  readonly availableCapital: bigint;
  readonly reservedCapital: bigint;
}

// ---------------------------------------------------------------------------
// Request DTOs (write-endpoint inputs). uint256 amounts are decimal strings.
// ---------------------------------------------------------------------------

/** Body for `PolicyManager.buyPolicy`. */
export interface BuyPolicyInput {
  readonly batchId: Bytes32;
  readonly token: Address;
  readonly coverage: string;
}

/** Body for `PolicyManager.cancelPolicy` / `markClaimed`. */
export interface PolicyIdInput {
  readonly policyId: Bytes32;
}

/** Body for `ClaimsProcessor.fileClaim`. */
export interface FileClaimInput {
  readonly policyId: Bytes32;
  readonly amount: string;
}

/** Body for claim lifecycle transitions keyed by claim id. */
export interface ClaimIdInput {
  readonly claimId: Bytes32;
}
