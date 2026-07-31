/**
 * View-model helpers for the insurance section (policies, claims, pools).
 *
 * Pure, framework-free logic shared across the list/detail pages: status-facet
 * definitions, client-side matching/sorting keys, and timeline derivation from
 * a record's lifecycle state. Kept separate from `lib/insurance.ts` (the event
 * reducers) so page-only concerns live in the section's own directory.
 */
import {
  ClaimState,
  PolicyState,
  claimStateLabel,
  policyStateLabel,
} from "@proofchain/shared";
import type { ClaimRecord, PolicyRecord } from "@/lib/insurance";
import { claimStateTone, policyStateTone } from "@/lib/insurance";
import type { ToneName } from "@/lib/format";
import { shortenHex } from "@/lib/format";
import type { SortKey } from "./list-utils";
import { textIncludes } from "./list-utils";

// ─── Status facets ───────────────────────────────────────────────────────────

export interface StatusOption {
  readonly value: string;
  readonly label: string;
}

export const POLICY_STATUS_OPTIONS: readonly StatusOption[] = [
  { value: "all", label: "All statuses" },
  { value: String(PolicyState.Active), label: "Active" },
  { value: String(PolicyState.Claimed), label: "Claimed" },
  { value: String(PolicyState.Expired), label: "Expired" },
  { value: String(PolicyState.Cancelled), label: "Cancelled" },
];

export const CLAIM_STATUS_OPTIONS: readonly StatusOption[] = [
  { value: "all", label: "All statuses" },
  { value: String(ClaimState.Filed), label: "Filed" },
  { value: String(ClaimState.Approved), label: "Approved" },
  { value: String(ClaimState.Paid), label: "Paid" },
  { value: String(ClaimState.Rejected), label: "Rejected" },
];

// ─── Filtering ───────────────────────────────────────────────────────────────

export function matchesPolicy(policy: PolicyRecord, query: string, status: string): boolean {
  const statusOk = status === "all" || String(policy.state) === status;
  const searchOk =
    !query ||
    textIncludes(policy.policyId, query) ||
    textIncludes(policy.batchId, query) ||
    textIncludes(policy.holder, query);
  return statusOk && searchOk;
}

export function matchesClaim(claim: ClaimRecord, query: string, status: string): boolean {
  const statusOk = status === "all" || String(claim.state) === status;
  const searchOk =
    !query ||
    textIncludes(claim.claimId, query) ||
    textIncludes(claim.policyId, query) ||
    textIncludes(claim.claimant, query);
  return statusOk && searchOk;
}

// ─── Sort keys ───────────────────────────────────────────────────────────────

export function policySortKey(id: string): ((p: PolicyRecord) => SortKey) | undefined {
  switch (id) {
    case "policyId":
      return (p) => p.policyId;
    case "coverage":
      return (p) => p.coverage ?? 0n;
    case "premium":
      return (p) => p.premium ?? 0n;
    case "state":
      return (p) => p.state;
    default:
      return undefined;
  }
}

export function claimSortKey(id: string): ((c: ClaimRecord) => SortKey) | undefined {
  switch (id) {
    case "claimId":
      return (c) => c.claimId;
    case "amount":
      return (c) => c.amount ?? 0n;
    case "state":
      return (c) => c.state;
    default:
      return undefined;
  }
}

// ─── Labels / tones ──────────────────────────────────────────────────────────

export function policyLabel(state: PolicyState): string {
  return policyStateLabel(state);
}
export function claimLabel(state: ClaimState): string {
  return claimStateLabel(state);
}
export function policyTone(state: PolicyState): ToneName {
  return policyStateTone(state);
}
export function claimTone(state: ClaimState): ToneName {
  return claimStateTone(state);
}

// ─── Timeline derivation ─────────────────────────────────────────────────────

export interface DerivedEvent {
  readonly id: string;
  readonly title: string;
  readonly tone: "neutral" | "info" | "success" | "warn" | "danger" | "brand";
  readonly description?: string;
}

/** Build a lifecycle timeline for a policy from its current state. */
export function policyTimeline(policy: PolicyRecord): readonly DerivedEvent[] {
  const events: DerivedEvent[] = [
    { id: "issued", title: "Policy issued", tone: "brand", description: `Cover on batch ${policy.batchId ? shortenHex(policy.batchId) : "—"}` },
  ];
  if (policy.state === PolicyState.Claimed) events.push({ id: "claimed", title: "Marked claimed", tone: "info" });
  if (policy.state === PolicyState.Expired) events.push({ id: "expired", title: "Policy expired", tone: "warn" });
  if (policy.state === PolicyState.Cancelled) events.push({ id: "cancelled", title: "Policy cancelled", tone: "neutral" });
  return events;
}

/** Build a lifecycle timeline for a claim from its current state. */
export function claimTimeline(claim: ClaimRecord): readonly DerivedEvent[] {
  const events: DerivedEvent[] = [{ id: "filed", title: "Claim filed", tone: "warn" }];
  if (claim.state === ClaimState.Approved || claim.state === ClaimState.Paid)
    events.push({ id: "approved", title: "Claim approved", tone: "brand" });
  if (claim.state === ClaimState.Paid) events.push({ id: "paid", title: "Claim paid out", tone: "success" });
  if (claim.state === ClaimState.Rejected) events.push({ id: "rejected", title: "Claim rejected", tone: "danger" });
  return events;
}
