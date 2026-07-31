import type { Address, Hex } from "viem";

/**
 * UI-facing view models mirroring the on-chain structs (see docs/SPEC.md).
 * These are constructed from decoded contract reads/events. Kept local so the
 * web package stays independently type-checkable.
 */

export interface BatchView {
  readonly batchId: Hex;
  readonly supplier: Address;
  readonly originHash: Hex;
  readonly metadataURI: string;
  readonly createdAt: number; // unix seconds
  readonly exists: boolean;
}

export interface CheckpointView {
  readonly batchId: Hex;
  readonly location: string;
  readonly timestamp: number; // unix seconds
  readonly dataHash: Hex;
}

export interface AttestationView {
  readonly batchId: Hex;
  readonly score: number; // bps 0..10000
  readonly verdictHash: Hex;
  readonly verdictURI: string;
  readonly attestedAt: number; // unix seconds
  readonly agent: Address;
  readonly exists: boolean;
}

export const DealState = {
  None: 0,
  Funded: 1,
  Released: 2,
  Refunded: 3,
  Disputed: 4,
} as const;

export type DealStateValue = (typeof DealState)[keyof typeof DealState];

export interface DealView {
  readonly batchId: Hex;
  readonly buyer: Address;
  readonly supplier: Address;
  readonly token: Address;
  readonly amount: bigint;
  readonly state: DealStateValue;
}

/** A batch registration discovered from a `BatchRegistered` event. */
export interface BatchRegisteredEvent {
  readonly batchId: Hex;
  readonly supplier: Address;
  readonly originHash: Hex;
  readonly metadataURI: string;
  readonly blockNumber: bigint;
  readonly transactionHash: Hex;
}

/** Timeline event kinds for the deal-detail view. */
export type TimelineKind =
  | "registered"
  | "checkpoint"
  | "funded"
  | "attested"
  | "released"
  | "disputed"
  | "refunded";

export interface TimelineItem {
  readonly kind: TimelineKind;
  readonly title: string;
  readonly description?: string;
  readonly timestamp?: number;
  readonly txHash?: Hex;
}
