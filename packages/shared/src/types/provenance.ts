/**
 * `provenance` domain types.
 *
 * The on-chain struct mirrors and status enums for this domain (`Batch`,
 * `Checkpoint`, `Attestation`, `Series`, `MetadataKV`) live in `./core` and are
 * re-exported from the package root. This module adds:
 *
 *  - **Decoded-event payload types** — the typed shape each key provenance event
 *    normalizes to (produced by `../decoders/provenance`).
 *  - **Request / read-model DTOs** — the request bodies and aggregate views the
 *    `api`/`web` packages exchange, plus zod schemas that validate them at the
 *    boundary.
 *
 * Every field is `readonly`; `bigint` mirrors uint256/uint64/int256 and `number`
 * mirrors uint8/uint16. Branded `Address` / `Bytes32` come from `./core`.
 *
 * Re-exported by `../types/index.ts`.
 */
import { z } from "zod";

import {
  Bytes32Schema,
  ScoreBpsSchema,
  type Address,
  type Attestation,
  type Batch,
  type Bytes32,
  type Checkpoint,
  type MetadataKV,
  type Series,
} from "./core";

// ---------------------------------------------------------------------------
// Local branded arg schemas (transform to the branded string literal types)
// ---------------------------------------------------------------------------

const bytes32 = Bytes32Schema as unknown as z.ZodType<Bytes32>;

// ---------------------------------------------------------------------------
// Decoded event payloads (one per key event; mirrors the ABI input names)
// ---------------------------------------------------------------------------

/** `ProvenanceRegistry.BatchRegistered`. */
export interface BatchRegisteredArgs {
  readonly batchId: Bytes32;
  readonly supplier: Address;
  readonly originHash: Bytes32;
  readonly metadataURI: string;
}

/** `ProvenanceRegistry.CheckpointAdded`. */
export interface CheckpointAddedArgs {
  readonly batchId: Bytes32;
  readonly location: string;
  readonly timestamp: bigint; // uint64
  readonly dataHash: Bytes32;
}

/** `AttestationRegistry.Attested`. */
export interface AttestedArgs {
  readonly batchId: Bytes32;
  readonly score: number; // uint16 bps
  readonly verdictHash: Bytes32;
  readonly verdictURI: string;
  readonly agent: Address;
}

/** `ProvenanceFactory.SeriesCreated`. */
export interface SeriesCreatedArgs {
  readonly seriesId: Bytes32;
  readonly creator: Address;
  readonly metadataURI: string;
}

/** `ProvenanceFactory.RegisteredFromSeries`. */
export interface RegisteredFromSeriesArgs {
  readonly seriesId: Bytes32;
  readonly batchId: Bytes32;
  readonly index: bigint; // uint256
}

/** `BatchMetadataStore.MetadataSet`. */
export interface MetadataSetArgs {
  readonly batchId: Bytes32;
  readonly key: Bytes32;
  readonly value: string;
}

/** `CheckpointOracle.CheckpointPushed`. */
export interface CheckpointPushedArgs {
  readonly batchId: Bytes32;
  readonly location: string;
  readonly temp: bigint; // int256, signed (e.g. milli-degrees C)
  readonly dataHash: Bytes32;
  readonly keeper: Address;
}

/**
 * Discriminated union of every decoded provenance event, tagged by its source
 * contract and event name. Returned by `decodeProvenanceEvent`.
 */
export type ProvenanceEvent =
  | { readonly contract: "ProvenanceRegistry"; readonly eventName: "BatchRegistered"; readonly args: BatchRegisteredArgs }
  | { readonly contract: "ProvenanceRegistry"; readonly eventName: "CheckpointAdded"; readonly args: CheckpointAddedArgs }
  | { readonly contract: "AttestationRegistry"; readonly eventName: "Attested"; readonly args: AttestedArgs }
  | { readonly contract: "ProvenanceFactory"; readonly eventName: "SeriesCreated"; readonly args: SeriesCreatedArgs }
  | { readonly contract: "ProvenanceFactory"; readonly eventName: "RegisteredFromSeries"; readonly args: RegisteredFromSeriesArgs }
  | { readonly contract: "BatchMetadataStore"; readonly eventName: "MetadataSet"; readonly args: MetadataSetArgs }
  | { readonly contract: "CheckpointOracle"; readonly eventName: "CheckpointPushed"; readonly args: CheckpointPushedArgs };

/** All provenance event names, useful for indexer topic filtering. */
export const PROVENANCE_EVENT_NAMES = [
  "BatchRegistered",
  "CheckpointAdded",
  "Attested",
  "SeriesCreated",
  "RegisteredFromSeries",
  "MetadataSet",
  "CheckpointPushed",
] as const;

export type ProvenanceEventName = (typeof PROVENANCE_EVENT_NAMES)[number];

// ---------------------------------------------------------------------------
// Request DTOs (api/web → chain writes) with boundary validation
// ---------------------------------------------------------------------------

/** Body for `ProvenanceRegistry.registerBatch`. */
export interface RegisterBatchRequest {
  readonly batchId: Bytes32;
  readonly originHash: Bytes32;
  readonly metadataURI: string;
}

export const RegisterBatchRequestSchema: z.ZodType<RegisterBatchRequest> = z.object({
  batchId: bytes32,
  originHash: bytes32,
  metadataURI: z.string().min(1, "metadataURI must not be empty"),
});

/** Body for `ProvenanceRegistry.addCheckpoint`. `timestamp` is unix seconds. */
export interface AddCheckpointRequest {
  readonly batchId: Bytes32;
  readonly location: string;
  readonly timestamp: number;
  readonly dataHash: Bytes32;
}

export const AddCheckpointRequestSchema: z.ZodType<AddCheckpointRequest> = z.object({
  batchId: bytes32,
  location: z.string().min(1, "location must not be empty"),
  timestamp: z.number().int().nonnegative(),
  dataHash: bytes32,
});

/** Body for `AttestationRegistry.attest`. */
export interface AttestRequest {
  readonly batchId: Bytes32;
  readonly score: number;
  readonly verdictHash: Bytes32;
  readonly verdictURI: string;
}

export const AttestRequestSchema: z.ZodType<AttestRequest> = z.object({
  batchId: bytes32,
  score: ScoreBpsSchema,
  verdictHash: bytes32,
  verdictURI: z.string().min(1, "verdictURI must not be empty"),
});

/** Body for `ProvenanceFactory.createSeries`. */
export interface CreateSeriesRequest {
  readonly seriesId: Bytes32;
  readonly metadataURI: string;
}

export const CreateSeriesRequestSchema: z.ZodType<CreateSeriesRequest> = z.object({
  seriesId: bytes32,
  metadataURI: z.string().min(1, "metadataURI must not be empty"),
});

/** Body for `ProvenanceFactory.registerFromSeries`. */
export interface RegisterFromSeriesRequest {
  readonly seriesId: Bytes32;
  readonly batchId: Bytes32;
  readonly originHash: Bytes32;
}

export const RegisterFromSeriesRequestSchema: z.ZodType<RegisterFromSeriesRequest> = z.object({
  seriesId: bytes32,
  batchId: bytes32,
  originHash: bytes32,
});

/** A single metadata key/value pair as submitted from the client. */
export interface MetadataEntryInput {
  readonly key: Bytes32;
  readonly value: string;
}

/** Body for `BatchMetadataStore.setMetadata`. */
export interface SetMetadataRequest {
  readonly batchId: Bytes32;
  readonly entries: readonly MetadataEntryInput[];
}

export const SetMetadataRequestSchema: z.ZodType<SetMetadataRequest> = z.object({
  batchId: bytes32,
  entries: z
    .array(z.object({ key: bytes32, value: z.string() }))
    .min(1, "at least one metadata entry is required"),
});

// ---------------------------------------------------------------------------
// Read-model DTOs (aggregate chain views for api/web)
// ---------------------------------------------------------------------------

/** Aggregate provenance view for a single batch. */
export interface BatchView {
  readonly batch: Batch;
  readonly checkpoints: readonly Checkpoint[];
  readonly attestation: Attestation | null;
  readonly metadata: readonly MetadataKV[];
}

/** Aggregate view of a series template plus its derived batch ids. */
export interface SeriesView {
  readonly series: Series;
  readonly batchIds: readonly Bytes32[];
}
