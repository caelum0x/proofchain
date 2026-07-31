/**
 * Checkpoints repository — typed data access for the `checkpoints` provenance
 * table (append-only supply-chain journey points attached to a batch: origin,
 * transit, customs, delivery, IoT readings). See `deals.ts` for the fill
 * convention; never hand-edit `index.ts`.
 *
 * The backing table is defined in `schema/05_provenance.sql`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Bytes32Hex } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/**
 * Fields accepted when creating a checkpoint. `id` is the natural key
 * `<batchId>:<sequence>` so re-indexing the same on-chain event is idempotent.
 */
export const CheckpointInput = z.object({
  id: z.string().min(1),
  batchId: Bytes32Hex,
  sequence: z.number().int().min(0).optional(),
  kind: z.string().min(1).optional(),
  actor: AddressHex.nullable().optional(),
  location: z.string().nullable().optional(),
  uri: z.string().nullable().optional(),
  contentHash: Bytes32Hex.nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  occurredAt: z.string().nullable().optional(),
});
export type CheckpointInput = z.infer<typeof CheckpointInput>;

/** A checkpoint row as stored/returned. */
export const Checkpoint = z.object({
  id: z.string(),
  batchId: Bytes32Hex,
  sequence: z.number().int().min(0),
  kind: z.string(),
  actor: AddressHex.nullable(),
  location: z.string().nullable(),
  uri: z.string().nullable(),
  contentHash: Bytes32Hex.nullable(),
  metadata: z.record(z.unknown()),
  occurredAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Checkpoint = z.infer<typeof Checkpoint>;

const config: RepositoryConfig<Checkpoint, CheckpointInput> = {
  table: "checkpoints",
  primaryKey: "id",
  entitySchema: Checkpoint,
  insertSchema: CheckpointInput,
  toRow: (c) => ({
    id: c.id,
    batch_id: c.batchId,
    sequence: c.sequence ?? 0,
    kind: c.kind ?? "checkpoint",
    actor: c.actor ?? null,
    location: c.location ?? null,
    uri: c.uri ?? null,
    content_hash: c.contentHash ?? null,
    metadata: c.metadata ?? {},
    occurred_at: c.occurredAt ?? null,
  }),
  fromRow: (row) => ({
    id: row.id,
    batchId: row.batch_id,
    sequence: toInt(row.sequence),
    kind: row.kind,
    actor: row.actor ?? null,
    location: row.location ?? null,
    uri: row.uri ?? null,
    contentHash: row.content_hash ?? null,
    metadata: row.metadata ?? {},
    occurredAt: normalizeTimestamp(row.occurred_at) ?? null,
    createdAt: normalizeTimestamp(row.created_at),
  }),
};

/** Typed data access for the `checkpoints` table. */
export class CheckpointsRepository extends BaseRepository<
  Checkpoint,
  CheckpointInput
> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** The full ordered checkpoint trail for a batch (sequence ascending). */
  findByBatch(batchId: string): Promise<Result<readonly Checkpoint[]>> {
    return this.find({
      filters: [{ column: "batch_id", op: "eq", value: batchId }],
      orderBy: { column: "sequence", ascending: true },
    });
  }

  /** All checkpoints of a given kind (e.g. "customs", "delivery"). */
  findByKind(kind: string): Promise<Result<readonly Checkpoint[]>> {
    return this.find({
      filters: [{ column: "kind", op: "eq", value: kind }],
      orderBy: { column: "created_at", ascending: false },
    });
  }
}

/** Factory: build a `CheckpointsRepository` over the (possibly null) client. */
export function createCheckpointsRepository(
  client: SupabaseClient | null,
): CheckpointsRepository {
  return new CheckpointsRepository(client);
}

function toInt(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
