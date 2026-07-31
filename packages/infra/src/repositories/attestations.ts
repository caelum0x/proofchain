/**
 * Attestations repository — typed data access for the `attestations` table (the
 * AttestationRegistry read model: append-only AI verification attestations, one
 * row per on-chain attestation event / version). See `deals.ts` for the fill
 * convention; never hand-edit `index.ts`.
 *
 * The backing table is defined in `schema/05_provenance.sql`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, BasisPoints, Bytes32Hex } from "../types.js";
import { ok, type Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/**
 * Fields accepted when creating an attestation. `id` is the natural key
 * (attestation hash, or `<batchId>:<version>`) so re-indexing is idempotent.
 */
export const AttestationInput = z.object({
  id: z.string().min(1),
  batchId: Bytes32Hex,
  attester: AddressHex.nullable().optional(),
  score: BasisPoints,
  passed: z.boolean(),
  threshold: BasisPoints.optional(),
  version: z.number().int().min(1).optional(),
  verdictHash: Bytes32Hex.nullable().optional(),
  uri: z.string().nullable().optional(),
  txHash: Bytes32Hex.nullable().optional(),
});
export type AttestationInput = z.infer<typeof AttestationInput>;

/** An attestation row as stored/returned. */
export const Attestation = z.object({
  id: z.string(),
  batchId: Bytes32Hex,
  attester: AddressHex.nullable(),
  score: BasisPoints,
  passed: z.boolean(),
  threshold: BasisPoints,
  version: z.number().int().min(1),
  verdictHash: Bytes32Hex.nullable(),
  uri: z.string().nullable(),
  txHash: Bytes32Hex.nullable(),
  createdAt: z.string(),
});
export type Attestation = z.infer<typeof Attestation>;

const config: RepositoryConfig<Attestation, AttestationInput> = {
  table: "attestations",
  primaryKey: "id",
  entitySchema: Attestation,
  insertSchema: AttestationInput,
  toRow: (a) => ({
    id: a.id,
    batch_id: a.batchId,
    attester: a.attester ?? null,
    score: a.score,
    passed: a.passed,
    threshold: a.threshold ?? 0,
    version: a.version ?? 1,
    verdict_hash: a.verdictHash ?? null,
    uri: a.uri ?? null,
    tx_hash: a.txHash ?? null,
  }),
  fromRow: (row) => ({
    id: row.id,
    batchId: row.batch_id,
    attester: row.attester ?? null,
    score: toInt(row.score),
    passed: Boolean(row.passed),
    threshold: toInt(row.threshold),
    version: toInt(row.version),
    verdictHash: row.verdict_hash ?? null,
    uri: row.uri ?? null,
    txHash: row.tx_hash ?? null,
    createdAt: normalizeTimestamp(row.created_at),
  }),
};

/** Typed data access for the `attestations` table. */
export class AttestationsRepository extends BaseRepository<
  Attestation,
  AttestationInput
> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All attestations for a batch, newest version first. */
  findByBatch(batchId: string): Promise<Result<readonly Attestation[]>> {
    return this.find({
      filters: [{ column: "batch_id", op: "eq", value: batchId }],
      orderBy: { column: "version", ascending: false },
    });
  }

  /** All attestations with the given pass/fail outcome. */
  findByPassed(passed: boolean): Promise<Result<readonly Attestation[]>> {
    return this.find({
      filters: [{ column: "passed", op: "eq", value: passed }],
      orderBy: { column: "created_at", ascending: false },
    });
  }

  /** The most recent attestation for a batch, or `null` if none exists. */
  async latestForBatch(batchId: string): Promise<Result<Attestation | null>> {
    const res = await this.find({
      filters: [{ column: "batch_id", op: "eq", value: batchId }],
      orderBy: { column: "version", ascending: false },
      limit: 1,
    });
    if (!res.success) return res;
    return ok<Attestation | null>(res.data[0] ?? null);
  }
}

/** Factory: build an `AttestationsRepository` over the (possibly null) client. */
export function createAttestationsRepository(
  client: SupabaseClient | null,
): AttestationsRepository {
  return new AttestationsRepository(client);
}

function toInt(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
