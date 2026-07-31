import type { Address, Hex } from "viem";
import { ClaimState, PolicyState } from "@proofchain/shared";
import type { ToneName } from "./format";
import { logOrder } from "./finance";

/**
 * Pure, framework-free helpers for the insurance domain (policies, claims,
 * pool capital). Side-effect free and unit-tested so hooks/pages can rely on
 * correct state derivation from event streams.
 */

export { logOrder };

// ─── Tone mapping ────────────────────────────────────────────────────────────

export function policyStateTone(state: PolicyState): ToneName {
  switch (state) {
    case PolicyState.Active:
      return "success";
    case PolicyState.Claimed:
      return "brand";
    case PolicyState.Expired:
      return "warn";
    case PolicyState.Cancelled:
      return "neutral";
    case PolicyState.None:
    default:
      return "neutral";
  }
}

export function claimStateTone(state: ClaimState): ToneName {
  switch (state) {
    case ClaimState.Filed:
      return "warn";
    case ClaimState.Approved:
      return "brand";
    case ClaimState.Paid:
      return "success";
    case ClaimState.Rejected:
      return "danger";
    case ClaimState.None:
    default:
      return "neutral";
  }
}

// ─── Pool math ───────────────────────────────────────────────────────────────

/**
 * Share of pool capital reserved against active policies, in basis points
 * (0..10000). Guards zero-capital and clamps to 100%.
 */
export function reservedRatioBps(reserved: bigint, total: bigint): number {
  if (total <= 0n || reserved <= 0n) return 0;
  const bps = (reserved * 10_000n) / total;
  return Number(bps > 10_000n ? 10_000n : bps);
}

// ─── Policy event reduction ──────────────────────────────────────────────────

export type PolicyEventKind = "issued" | "cancelled";

export interface PolicyEvent {
  readonly kind: PolicyEventKind;
  readonly policyId: Hex;
  readonly order: bigint;
  readonly batchId?: Hex;
  readonly holder?: Address;
  readonly coverage?: bigint;
  readonly premium?: bigint;
}

export interface PolicyRecord {
  readonly policyId: Hex;
  readonly batchId?: Hex;
  readonly holder?: Address;
  readonly coverage?: bigint;
  readonly premium?: bigint;
  readonly state: PolicyState;
  readonly order: bigint;
}

/** Fold PolicyManager events into the current policy per policyId. */
export function reducePolicyEvents(events: readonly PolicyEvent[]): PolicyRecord[] {
  const ordered = [...events].sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
  const byId = new Map<Hex, PolicyRecord>();

  for (const ev of ordered) {
    const prev = byId.get(ev.policyId);
    if (ev.kind === "issued") {
      byId.set(ev.policyId, {
        policyId: ev.policyId,
        batchId: ev.batchId,
        holder: ev.holder,
        coverage: ev.coverage,
        premium: ev.premium,
        state: PolicyState.Active,
        order: ev.order,
      });
    } else if (ev.kind === "cancelled" && prev) {
      byId.set(ev.policyId, { ...prev, state: PolicyState.Cancelled, order: ev.order });
    }
  }

  return [...byId.values()].sort((a, b) => (a.order > b.order ? -1 : a.order < b.order ? 1 : 0));
}

// ─── Claim event reduction ───────────────────────────────────────────────────

export type ClaimEventKind = "filed" | "approved" | "rejected" | "paid";

export interface ClaimEvent {
  readonly kind: ClaimEventKind;
  readonly claimId: Hex;
  readonly order: bigint;
  readonly policyId?: Hex;
  readonly claimant?: Address;
  readonly amount?: bigint;
}

export interface ClaimRecord {
  readonly claimId: Hex;
  readonly policyId?: Hex;
  readonly claimant?: Address;
  readonly amount?: bigint;
  readonly state: ClaimState;
  readonly order: bigint;
}

const CLAIM_STATE_OF: Readonly<Record<ClaimEventKind, ClaimState>> = {
  filed: ClaimState.Filed,
  approved: ClaimState.Approved,
  rejected: ClaimState.Rejected,
  paid: ClaimState.Paid,
};

/** Fold ClaimsProcessor events into the current claim per claimId. */
export function reduceClaimEvents(events: readonly ClaimEvent[]): ClaimRecord[] {
  const ordered = [...events].sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
  const byId = new Map<Hex, ClaimRecord>();

  for (const ev of ordered) {
    const prev = byId.get(ev.claimId);
    if (ev.kind === "filed") {
      byId.set(ev.claimId, {
        claimId: ev.claimId,
        policyId: ev.policyId,
        claimant: ev.claimant,
        amount: ev.amount,
        state: ClaimState.Filed,
        order: ev.order,
      });
    } else if (prev) {
      byId.set(ev.claimId, { ...prev, state: CLAIM_STATE_OF[ev.kind], order: ev.order });
    }
  }

  return [...byId.values()].sort((a, b) => (a.order > b.order ? -1 : a.order < b.order ? 1 : 0));
}

/** Claims an arbiter still needs to act on. */
export function pendingClaims(records: readonly ClaimRecord[]): ClaimRecord[] {
  return records.filter((r) => r.state === ClaimState.Filed);
}

/** Claims approved and awaiting payout. */
export function payableClaims(records: readonly ClaimRecord[]): ClaimRecord[] {
  return records.filter((r) => r.state === ClaimState.Approved);
}
