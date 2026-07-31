import type { Address, Hex } from "viem";
import { InvoiceListingState } from "@proofchain/shared";
import type { ToneName } from "./format";

/**
 * Pure, framework-free helpers for the finance domain (invoice financing,
 * pools, lending). Kept side-effect free and unit-tested so the React hooks /
 * pages can rely on correct state derivation and financial math.
 */

// ─── Tone mapping ────────────────────────────────────────────────────────────

/** Badge tone for an invoice-financing listing state. */
export function invoiceListingStateTone(state: InvoiceListingState): ToneName {
  switch (state) {
    case InvoiceListingState.Listed:
      return "brand";
    case InvoiceListingState.Funded:
      return "warn";
    case InvoiceListingState.Claimed:
      return "success";
    case InvoiceListingState.Cancelled:
      return "neutral";
    case InvoiceListingState.None:
    default:
      return "neutral";
  }
}

/** Badge tone for a composite risk grade (0 ungraded, 1 best .. 7 worst). */
export function riskGradeTone(grade: number): ToneName {
  if (grade <= 0) return "neutral";
  if (grade <= 2) return "success";
  if (grade <= 4) return "brand";
  if (grade === 5) return "warn";
  return "danger";
}

// ─── Pool math ───────────────────────────────────────────────────────────────

/**
 * Fraction of pool capital currently deployed into receivables, in basis
 * points (0..10000). Guards against division by zero and clamps to 100%.
 */
export function utilizationBps(deployed: bigint, total: bigint): number {
  if (total <= 0n || deployed <= 0n) return 0;
  const bps = (deployed * 10_000n) / total;
  return Number(bps > 10_000n ? 10_000n : bps);
}

/**
 * Net asset value per vault share, as a display float. When the vault has no
 * shares yet the price is par (1.0). Shares and assets share the same decimals
 * (OZ ERC4626 default), so the ratio is dimensionless.
 */
export function navPerShare(totalAssets: bigint, totalSupply: bigint): number {
  if (totalSupply <= 0n) return 1;
  const scaled = (totalAssets * 1_000_000n) / totalSupply;
  return Number(scaled) / 1_000_000;
}

// ─── Listing event reduction ─────────────────────────────────────────────────

export type ListingEventKind = "listed" | "funded" | "claimed" | "cancelled";

/** A normalized InvoiceFinancing event, ordered for deterministic folding. */
export interface ListingEvent {
  readonly kind: ListingEventKind;
  readonly batchId: Hex;
  /** Sort key: monotonically increasing across the chain (block*offset+index). */
  readonly order: bigint;
  readonly supplier?: Address;
  readonly token?: Address;
  readonly askAmount?: bigint;
  readonly lender?: Address;
}

/** The current state of a financing listing derived purely from its events. */
export interface FinancingListingRecord {
  readonly batchId: Hex;
  readonly supplier?: Address;
  readonly lender?: Address;
  readonly token?: Address;
  readonly askAmount?: bigint;
  readonly state: InvoiceListingState;
  readonly order: bigint;
}

const TERMINAL: ReadonlySet<InvoiceListingState> = new Set([
  InvoiceListingState.Claimed,
  InvoiceListingState.Cancelled,
]);

/**
 * Fold a stream of InvoiceFinancing events into the current listing per batch.
 * Events are applied in `order`; a `Listed` after a terminal state starts a
 * fresh listing (re-listing). Returns records most-recent-first.
 */
export function reduceListingEvents(
  events: readonly ListingEvent[],
): FinancingListingRecord[] {
  const ordered = [...events].sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
  const byBatch = new Map<Hex, FinancingListingRecord>();

  for (const ev of ordered) {
    const prev = byBatch.get(ev.batchId);
    switch (ev.kind) {
      case "listed":
        byBatch.set(ev.batchId, {
          batchId: ev.batchId,
          supplier: ev.supplier,
          token: ev.token,
          askAmount: ev.askAmount,
          lender: undefined,
          state: InvoiceListingState.Listed,
          order: ev.order,
        });
        break;
      case "funded":
        if (!prev) break;
        byBatch.set(ev.batchId, {
          ...prev,
          lender: ev.lender ?? prev.lender,
          state: InvoiceListingState.Funded,
          order: ev.order,
        });
        break;
      case "claimed":
        if (!prev) break;
        byBatch.set(ev.batchId, { ...prev, state: InvoiceListingState.Claimed, order: ev.order });
        break;
      case "cancelled":
        if (!prev) break;
        byBatch.set(ev.batchId, { ...prev, state: InvoiceListingState.Cancelled, order: ev.order });
        break;
    }
  }

  return [...byBatch.values()].sort((a, b) => (a.order > b.order ? -1 : a.order < b.order ? 1 : 0));
}

/** Active listings a lender can fund. */
export function openListings(
  records: readonly FinancingListingRecord[],
): FinancingListingRecord[] {
  return records.filter((r) => r.state === InvoiceListingState.Listed);
}

/** True when a listing is in a terminal (closed) state. */
export function isListingClosed(state: InvoiceListingState): boolean {
  return TERMINAL.has(state);
}

/** Compose a stable ordering key from a log's block number and log index. */
export function logOrder(blockNumber: bigint | null | undefined, logIndex: number | null | undefined): bigint {
  const block = blockNumber ?? 0n;
  const index = BigInt(logIndex ?? 0);
  return block * 1_000_000n + index;
}
