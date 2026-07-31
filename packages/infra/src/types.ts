/**
 * Zod schemas + inferred types for the infra data layer.
 *
 * These are the single source of truth validated at every boundary (before a
 * DB write, after a DB read). They mirror `schema.sql` exactly, including the
 * hex-format and basis-point range constraints, so the DB and the client can
 * never disagree about what "valid" means.
 */
import { z } from "zod";

/** 0x-prefixed 32-byte hex (batch ids, tx hashes, content hashes). */
export const Bytes32Hex = z
  .string()
  .regex(/^0x[0-9a-f]{64}$/, "must be a lowercase 0x-prefixed 32-byte hex string");

/** 0x-prefixed 20-byte hex (EVM address, lowercased). */
export const AddressHex = z
  .string()
  .regex(/^0x[0-9a-f]{40}$/, "must be a lowercase 0x-prefixed 20-byte address");

/** Basis points, 0..10000 inclusive (uint16 bps on-chain). */
export const BasisPoints = z.number().int().min(0).max(10000);

/** uint256 amount serialized as a base-10 string (avoids JS number overflow). */
export const Uint256String = z
  .string()
  .regex(/^\d+$/, "must be a base-10 uint256 string");

export const JobStatus = z.enum(["queued", "running", "succeeded", "failed"]);
export type JobStatus = z.infer<typeof JobStatus>;

export const DealState = z.enum(["funded", "released", "refunded", "disputed"]);
export type DealState = z.infer<typeof DealState>;

/** Structured error envelope persisted in jobs.error. */
export const ErrorEnvelopeSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

// -----------------------------------------------------------------------------
// jobs
// -----------------------------------------------------------------------------

/** Fields accepted when creating/upserting a job (server-owned fields omitted). */
export const JobInput = z.object({
  id: z.string().uuid().optional(),
  batchId: Bytes32Hex,
  status: JobStatus.default("queued"),
  request: z.record(z.unknown()).default({}),
  result: z.record(z.unknown()).nullable().optional(),
  error: ErrorEnvelopeSchema.nullable().optional(),
  txHash: Bytes32Hex.nullable().optional(),
});
export type JobInput = z.infer<typeof JobInput>;

/** A job row as stored/returned. */
export const Job = z.object({
  id: z.string().uuid(),
  batchId: Bytes32Hex,
  status: JobStatus,
  request: z.record(z.unknown()),
  result: z.record(z.unknown()).nullable(),
  error: ErrorEnvelopeSchema.nullable(),
  txHash: Bytes32Hex.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Job = z.infer<typeof Job>;

// -----------------------------------------------------------------------------
// verdicts
// -----------------------------------------------------------------------------

export const VerdictInput = z.object({
  batchId: Bytes32Hex,
  score: BasisPoints,
  passed: z.boolean(),
  threshold: BasisPoints,
  findings: z.array(z.record(z.unknown())).default([]),
  documentHashes: z.array(z.string()).default([]),
  verdictHash: Bytes32Hex,
  verdictUri: z.string().nullable().optional(),
  model: z.string().min(1),
});
export type VerdictInput = z.infer<typeof VerdictInput>;

export const Verdict = z.object({
  batchId: Bytes32Hex,
  score: BasisPoints,
  passed: z.boolean(),
  threshold: BasisPoints,
  findings: z.array(z.record(z.unknown())),
  documentHashes: z.array(z.string()),
  verdictHash: Bytes32Hex,
  verdictUri: z.string().nullable(),
  model: z.string(),
  createdAt: z.string(),
});
export type Verdict = z.infer<typeof Verdict>;

// -----------------------------------------------------------------------------
// deals
// -----------------------------------------------------------------------------

export const DealInput = z.object({
  batchId: Bytes32Hex,
  buyer: AddressHex,
  supplier: AddressHex,
  token: AddressHex,
  amount: Uint256String,
  state: DealState,
  txHash: Bytes32Hex.nullable().optional(),
});
export type DealInput = z.infer<typeof DealInput>;

export const Deal = z.object({
  batchId: Bytes32Hex,
  buyer: AddressHex,
  supplier: AddressHex,
  token: AddressHex,
  amount: Uint256String,
  state: DealState,
  txHash: Bytes32Hex.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Deal = z.infer<typeof Deal>;
