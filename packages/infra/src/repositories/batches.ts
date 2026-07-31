/**
 * Batches repository — typed data access for the `batches` provenance table (the
 * core BatchRegistry read model: one row per registered production/shipment
 * batch). See `deals.ts` for the fill convention; never hand-edit `index.ts`.
 *
 * The backing table is defined in `schema/05_provenance.sql`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Bytes32Hex, Uint256String } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Batch lifecycle states (mirrors the schema CHECK constraint). */
export const BatchStatus = z.enum([
  "created",
  "in_transit",
  "delivered",
  "verified",
  "settled",
  "disputed",
]);
export type BatchStatus = z.infer<typeof BatchStatus>;

/** Fields accepted when creating/upserting a batch. */
export const BatchInput = z.object({
  batchId: Bytes32Hex,
  supplier: AddressHex,
  buyer: AddressHex.nullable().optional(),
  product: z.string().nullable().optional(),
  quantity: Uint256String.optional(),
  unit: z.string().nullable().optional(),
  metadataUri: z.string().nullable().optional(),
  contentHash: Bytes32Hex.nullable().optional(),
  status: BatchStatus.optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type BatchInput = z.infer<typeof BatchInput>;

/** A batch row as stored/returned. */
export const Batch = z.object({
  batchId: Bytes32Hex,
  supplier: AddressHex,
  buyer: AddressHex.nullable(),
  product: z.string().nullable(),
  quantity: Uint256String,
  unit: z.string().nullable(),
  metadataUri: z.string().nullable(),
  contentHash: Bytes32Hex.nullable(),
  status: BatchStatus,
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Batch = z.infer<typeof Batch>;

const config: RepositoryConfig<Batch, BatchInput> = {
  table: "batches",
  primaryKey: "batch_id",
  entitySchema: Batch,
  insertSchema: BatchInput,
  toRow: (b) => ({
    batch_id: b.batchId,
    supplier: b.supplier,
    buyer: b.buyer ?? null,
    product: b.product ?? null,
    quantity: b.quantity ?? "0",
    unit: b.unit ?? null,
    metadata_uri: b.metadataUri ?? null,
    content_hash: b.contentHash ?? null,
    status: b.status ?? "created",
    metadata: b.metadata ?? {},
  }),
  fromRow: (row) => ({
    batchId: row.batch_id,
    supplier: row.supplier,
    buyer: row.buyer ?? null,
    product: row.product ?? null,
    quantity: toAmount(row.quantity),
    unit: row.unit ?? null,
    metadataUri: row.metadata_uri ?? null,
    contentHash: row.content_hash ?? null,
    status: row.status,
    metadata: row.metadata ?? {},
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `batches` table. */
export class BatchesRepository extends BaseRepository<Batch, BatchInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All batches registered by the given supplier, newest first. */
  findBySupplier(supplier: string): Promise<Result<readonly Batch[]>> {
    return this.find({
      filters: [{ column: "supplier", op: "eq", value: supplier }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All batches destined for the given buyer, newest first. */
  findByBuyer(buyer: string): Promise<Result<readonly Batch[]>> {
    return this.find({
      filters: [{ column: "buyer", op: "eq", value: buyer }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All batches currently in the given lifecycle status. */
  findByStatus(status: BatchStatus): Promise<Result<readonly Batch[]>> {
    return this.find({ filters: [{ column: "status", op: "eq", value: status }] });
  }
}

/** Factory: build a `BatchesRepository` over the (possibly null) client. */
export function createBatchesRepository(
  client: SupabaseClient | null,
): BatchesRepository {
  return new BatchesRepository(client);
}

function toAmount(value: unknown): string {
  return value === null || value === undefined ? "0" : String(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
