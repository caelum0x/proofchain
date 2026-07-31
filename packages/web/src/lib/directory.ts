import { isAddress, getAddress, type Address, type Hex } from "viem";
import type {
  ActorProfile,
  Organization,
  Reputation,
} from "@proofchain/shared";
import type { ToneName } from "./format";

/**
 * Pure helpers + view models for the identity / reputation / organization
 * directory pages (SPEC2 M3–M4). Kept free of React and wagmi so the decoding,
 * grading, and ranking logic is unit-testable in isolation.
 *
 * On-chain reads come back from viem as plain objects (named tuple components)
 * or positional arrays (multi-return functions). The decoders below normalise
 * both shapes into small, immutable UI view models — timestamps as unix seconds
 * (number) to match the rest of the web package (see `lib/types.ts`).
 */

// ─── View models ─────────────────────────────────────────────────────────────

/** A supplier/buyer/carrier profile as rendered by the directory pages. */
export interface ActorProfileView {
  readonly account: Address;
  readonly name: string;
  readonly uri: string;
  readonly registeredAt: number; // unix seconds
  readonly exists: boolean;
}

/** An organization record for the organizations pages. */
export interface OrganizationView {
  readonly orgId: Hex;
  readonly name: string;
  readonly orgType: number;
  readonly metadataURI: string;
  readonly admin: Address;
  readonly createdAt: number; // unix seconds
  readonly exists: boolean;
}

/** Reputation stats for the reputation / leaderboard pages. */
export interface ReputationView {
  readonly avgScoreBps: number;
  readonly totalDeals: number;
  readonly passRateBps: number;
  readonly disputes: number;
}

/** A leaderboard row: a profile joined with its reputation + risk grade. */
export interface LeaderboardEntry {
  readonly account: Address;
  readonly name: string;
  readonly reputation: ReputationView;
  readonly grade: number;
}

// ─── Address handling ────────────────────────────────────────────────────────

/**
 * Normalise a raw route/query address to a checksummed {@link Address}, or
 * `undefined` when it is not a valid 20-byte EVM address. Used to guard dynamic
 * `[address]` routes before issuing any on-chain read.
 */
export function normalizeAddress(value: string | undefined | null): Address | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!isAddress(trimmed)) return undefined;
  return getAddress(trimmed);
}

// ─── Decoders (viem tuple/array → view model) ────────────────────────────────

interface RawActorProfile {
  account: Address;
  name: string;
  uri: string;
  registeredAt: bigint;
  exists: boolean;
}

function toSeconds(value: bigint | number): number {
  return typeof value === "bigint" ? Number(value) : value;
}

/** Decode an `ActorProfile` tuple from `profileOf(...)`. */
export function decodeActorProfileView(raw: unknown): ActorProfileView | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<RawActorProfile>;
  if (typeof p.account !== "string" || typeof p.exists !== "boolean") return null;
  const view: ActorProfileView = {
    account: getAddress(p.account),
    name: typeof p.name === "string" ? p.name : "",
    uri: typeof p.uri === "string" ? p.uri : "",
    registeredAt: toSeconds(p.registeredAt ?? 0n),
    exists: p.exists,
  };
  // Compile-time guarantee we stay aligned with the shared struct shape.
  const _check: keyof ActorProfile extends keyof ActorProfileView | "registeredAt"
    ? true
    : never = true;
  void _check;
  return view;
}

interface RawOrganization {
  orgId: Hex;
  name: string;
  orgType: number;
  metadataURI: string;
  admin: Address;
  createdAt: bigint;
  exists: boolean;
}

/** Decode an `Organization` tuple from `orgOf(...)`. */
export function decodeOrganizationView(raw: unknown): OrganizationView | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<RawOrganization>;
  if (typeof o.orgId !== "string" || typeof o.exists !== "boolean") return null;
  const view: OrganizationView = {
    orgId: o.orgId,
    name: typeof o.name === "string" ? o.name : "",
    orgType: Number(o.orgType ?? 0),
    metadataURI: typeof o.metadataURI === "string" ? o.metadataURI : "",
    admin: typeof o.admin === "string" ? getAddress(o.admin) : ("0x0000000000000000000000000000000000000000" as Address),
    createdAt: toSeconds(o.createdAt ?? 0n),
    exists: o.exists,
  };
  const _check: keyof Organization extends keyof OrganizationView | "createdAt"
    ? true
    : never = true;
  void _check;
  return view;
}

/**
 * Decode a `Reputation` return from `reputationOf(...)`. viem returns either a
 * positional array `[avg, deals, pass, disputes]` or a named object depending on
 * ABI form; both are accepted.
 */
export function decodeReputationView(raw: unknown): ReputationView | null {
  if (Array.isArray(raw)) {
    if (raw.length < 4) return null;
    return {
      avgScoreBps: Number(raw[0] ?? 0),
      totalDeals: Number(raw[1] ?? 0),
      passRateBps: Number(raw[2] ?? 0),
      disputes: Number(raw[3] ?? 0),
    };
  }
  if (raw && typeof raw === "object") {
    const r = raw as Partial<Record<keyof Reputation, bigint | number>>;
    if (r.avgScoreBps === undefined && r.totalDeals === undefined) return null;
    return {
      avgScoreBps: Number(r.avgScoreBps ?? 0),
      totalDeals: Number(r.totalDeals ?? 0),
      passRateBps: Number(r.passRateBps ?? 0),
      disputes: Number(r.disputes ?? 0),
    };
  }
  return null;
}

/** An all-zero reputation, used when an address has no recorded outcomes. */
export const EMPTY_REPUTATION: ReputationView = Object.freeze({
  avgScoreBps: 0,
  totalDeals: 0,
  passRateBps: 0,
  disputes: 0,
});

// ─── Risk grade ──────────────────────────────────────────────────────────────

/**
 * Human labels for the `ScoreOracle.gradeOf` composite grade: 0 = ungraded,
 * 1 = best (A+) .. 7 = worst (F). Mirrors `RISK_GRADE_LABELS` in the shared
 * package (kept local to avoid a runtime dependency on shared from this layer).
 */
export const GRADE_LABELS: Readonly<Record<number, string>> = Object.freeze({
  0: "Ungraded",
  1: "A+",
  2: "A",
  3: "B",
  4: "C",
  5: "D",
  6: "E",
  7: "F",
});

export function gradeLabel(grade: number): string {
  return GRADE_LABELS[grade] ?? "Unknown";
}

/** Map a risk grade to a UI tone (best → success, worst → danger). */
export function gradeTone(grade: number): ToneName {
  if (grade <= 0) return "neutral";
  if (grade <= 2) return "success";
  if (grade <= 4) return "brand";
  if (grade === 5) return "warn";
  return "danger";
}

// ─── Leaderboard ranking ─────────────────────────────────────────────────────

/**
 * Rank suppliers for the leaderboard. Ordering (all descending): pass rate,
 * then average score, then total deals, then fewest disputes. Returns a new
 * sorted array (never mutates the input).
 */
export function sortLeaderboard(
  entries: readonly LeaderboardEntry[],
): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    const byPass = b.reputation.passRateBps - a.reputation.passRateBps;
    if (byPass !== 0) return byPass;
    const byScore = b.reputation.avgScoreBps - a.reputation.avgScoreBps;
    if (byScore !== 0) return byScore;
    const byDeals = b.reputation.totalDeals - a.reputation.totalDeals;
    if (byDeals !== 0) return byDeals;
    return a.reputation.disputes - b.reputation.disputes;
  });
}
