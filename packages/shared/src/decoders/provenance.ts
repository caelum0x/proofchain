/**
 * `provenance` domain event decoders.
 *
 * Each helper decodes a raw EVM log against the exact contract ABI (via the
 * core `decodeContractEvent`), then validates and normalizes the raw viem args
 * into the immutable, branded payload types from `../types/provenance`. Integer
 * args come back from viem as `bigint`; uint16 scores are narrowed to `number`,
 * while uint64/uint256/int256 stay `bigint`.
 *
 * Convention (mirrors `./core`): a decoder returns `null` when the log is not
 * the expected event, and throws `ValidationError` when the event matches but
 * its args are structurally malformed. Re-exported by `./index.ts`.
 */
import { z } from "zod";

import { AddressSchema, Bytes32Schema } from "../types";
import type {
  AttestedArgs,
  BatchRegisteredArgs,
  CheckpointAddedArgs,
  CheckpointPushedArgs,
  MetadataSetArgs,
  ProvenanceEvent,
  RegisteredFromSeriesArgs,
  SeriesCreatedArgs,
} from "../types/provenance";
import { ValidationError } from "../errors";
import { decodeContractEvent, parseRawEventLog } from "./core";

// ---------------------------------------------------------------------------
// Reusable arg-field schemas (viem-decoded shapes → branded/narrowed values)
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
      "Malformed provenance event args",
      result.error.flatten(),
    );
  }
  return Object.freeze(result.data);
}

// ---------------------------------------------------------------------------
// Per-event zod schemas
// ---------------------------------------------------------------------------

const batchRegisteredSchema = z.object({
  batchId: bytes32,
  supplier: address,
  originHash: bytes32,
  metadataURI: z.string(),
});

const checkpointAddedSchema = z.object({
  batchId: bytes32,
  location: z.string(),
  timestamp: bigintArg,
  dataHash: bytes32,
});

const attestedSchema = z.object({
  batchId: bytes32,
  score: uint16Arg,
  verdictHash: bytes32,
  verdictURI: z.string(),
  agent: address,
});

const seriesCreatedSchema = z.object({
  seriesId: bytes32,
  creator: address,
  metadataURI: z.string(),
});

const registeredFromSeriesSchema = z.object({
  seriesId: bytes32,
  batchId: bytes32,
  index: bigintArg,
});

const metadataSetSchema = z.object({
  batchId: bytes32,
  key: bytes32,
  value: z.string(),
});

const checkpointPushedSchema = z.object({
  batchId: bytes32,
  location: z.string(),
  temp: bigintArg,
  dataHash: bytes32,
  keeper: address,
});

// ---------------------------------------------------------------------------
// Single-event decoders
// ---------------------------------------------------------------------------

/** Decode a `ProvenanceRegistry.BatchRegistered` log, or `null`. */
export function decodeBatchRegistered(log: unknown): BatchRegisteredArgs | null {
  const ev = decodeContractEvent("ProvenanceRegistry", log);
  if (ev === null || ev.eventName !== "BatchRegistered") return null;
  return parseArgs(batchRegisteredSchema, ev.args);
}

/** Decode a `ProvenanceRegistry.CheckpointAdded` log, or `null`. */
export function decodeCheckpointAdded(log: unknown): CheckpointAddedArgs | null {
  const ev = decodeContractEvent("ProvenanceRegistry", log);
  if (ev === null || ev.eventName !== "CheckpointAdded") return null;
  return parseArgs(checkpointAddedSchema, ev.args);
}

/** Decode an `AttestationRegistry.Attested` log, or `null`. */
export function decodeAttested(log: unknown): AttestedArgs | null {
  const ev = decodeContractEvent("AttestationRegistry", log);
  if (ev === null || ev.eventName !== "Attested") return null;
  return parseArgs(attestedSchema, ev.args);
}

/** Decode a `ProvenanceFactory.SeriesCreated` log, or `null`. */
export function decodeSeriesCreated(log: unknown): SeriesCreatedArgs | null {
  const ev = decodeContractEvent("ProvenanceFactory", log);
  if (ev === null || ev.eventName !== "SeriesCreated") return null;
  return parseArgs(seriesCreatedSchema, ev.args);
}

/** Decode a `ProvenanceFactory.RegisteredFromSeries` log, or `null`. */
export function decodeRegisteredFromSeries(
  log: unknown,
): RegisteredFromSeriesArgs | null {
  const ev = decodeContractEvent("ProvenanceFactory", log);
  if (ev === null || ev.eventName !== "RegisteredFromSeries") return null;
  return parseArgs(registeredFromSeriesSchema, ev.args);
}

/** Decode a `BatchMetadataStore.MetadataSet` log, or `null`. */
export function decodeMetadataSet(log: unknown): MetadataSetArgs | null {
  const ev = decodeContractEvent("BatchMetadataStore", log);
  if (ev === null || ev.eventName !== "MetadataSet") return null;
  return parseArgs(metadataSetSchema, ev.args);
}

/** Decode a `CheckpointOracle.CheckpointPushed` log, or `null`. */
export function decodeCheckpointPushed(
  log: unknown,
): CheckpointPushedArgs | null {
  const ev = decodeContractEvent("CheckpointOracle", log);
  if (ev === null || ev.eventName !== "CheckpointPushed") return null;
  return parseArgs(checkpointPushedSchema, ev.args);
}

// ---------------------------------------------------------------------------
// Aggregate decoder
// ---------------------------------------------------------------------------

/**
 * Decode a log into the tagged {@link ProvenanceEvent} union, trying every
 * provenance contract in turn. Returns `null` when the log is not a recognized
 * provenance event. Throws `ValidationError` on structurally invalid input.
 */
export function decodeProvenanceEvent(log: unknown): ProvenanceEvent | null {
  const raw = parseRawEventLog(log);

  const pr = decodeContractEvent("ProvenanceRegistry", raw);
  if (pr !== null) {
    if (pr.eventName === "BatchRegistered") {
      return { contract: "ProvenanceRegistry", eventName: "BatchRegistered", args: parseArgs(batchRegisteredSchema, pr.args) };
    }
    if (pr.eventName === "CheckpointAdded") {
      return { contract: "ProvenanceRegistry", eventName: "CheckpointAdded", args: parseArgs(checkpointAddedSchema, pr.args) };
    }
  }

  const at = decodeContractEvent("AttestationRegistry", raw);
  if (at !== null && at.eventName === "Attested") {
    return { contract: "AttestationRegistry", eventName: "Attested", args: parseArgs(attestedSchema, at.args) };
  }

  const pf = decodeContractEvent("ProvenanceFactory", raw);
  if (pf !== null) {
    if (pf.eventName === "SeriesCreated") {
      return { contract: "ProvenanceFactory", eventName: "SeriesCreated", args: parseArgs(seriesCreatedSchema, pf.args) };
    }
    if (pf.eventName === "RegisteredFromSeries") {
      return { contract: "ProvenanceFactory", eventName: "RegisteredFromSeries", args: parseArgs(registeredFromSeriesSchema, pf.args) };
    }
  }

  const ms = decodeContractEvent("BatchMetadataStore", raw);
  if (ms !== null && ms.eventName === "MetadataSet") {
    return { contract: "BatchMetadataStore", eventName: "MetadataSet", args: parseArgs(metadataSetSchema, ms.args) };
  }

  const co = decodeContractEvent("CheckpointOracle", raw);
  if (co !== null && co.eventName === "CheckpointPushed") {
    return { contract: "CheckpointOracle", eventName: "CheckpointPushed", args: parseArgs(checkpointPushedSchema, co.args) };
  }

  return null;
}
