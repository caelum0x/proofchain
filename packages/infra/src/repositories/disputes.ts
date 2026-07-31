/**
 * Disputes repository — typed data access for the `disputes` table (M7 dispute
 * resolution / arbitration). Keyed by `batch_id` (one open dispute per batch).
 * See `deals.ts` for the fill convention; never hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Bytes32Hex } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Dispute lifecycle states (mirrors the schema CHECK constraint). */
export const DisputeStatus = z.enum(["open", "resolved"]);
export type DisputeStatus = z.infer<typeof DisputeStatus>;

/** Fields accepted when creating/upserting a dispute. */
export const DisputeInput = z.object({
  batchId: Bytes32Hex,
  opener: AddressHex.nullable().optional(),
  status: DisputeStatus.optional(),
  refundBuyer: z.boolean().nullable().optional(),
  votesFor: z.number().int().min(0).optional(),
  votesAgainst: z.number().int().min(0).optional(),
  resolvedAt: z.string().nullable().optional(),
});
export type DisputeInput = z.infer<typeof DisputeInput>;

/** A dispute row as stored/returned. */
export const Dispute = z.object({
  batchId: Bytes32Hex,
  opener: AddressHex.nullable(),
  status: DisputeStatus,
  refundBuyer: z.boolean().nullable(),
  votesFor: z.number().int().min(0),
  votesAgainst: z.number().int().min(0),
  resolvedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Dispute = z.infer<typeof Dispute>;

const config: RepositoryConfig<Dispute, DisputeInput> = {
  table: "disputes",
  primaryKey: "batch_id",
  entitySchema: Dispute,
  insertSchema: DisputeInput,
  toRow: (d) => ({
    batch_id: d.batchId,
    opener: d.opener ?? null,
    status: d.status ?? "open",
    refund_buyer: d.refundBuyer ?? null,
    votes_for: d.votesFor ?? 0,
    votes_against: d.votesAgainst ?? 0,
    resolved_at: d.resolvedAt ?? null,
  }),
  fromRow: (row) => ({
    batchId: row.batch_id,
    opener: row.opener ?? null,
    status: row.status,
    refundBuyer: row.refund_buyer ?? null,
    votesFor: toInt(row.votes_for),
    votesAgainst: toInt(row.votes_against),
    resolvedAt: normalizeTimestampOrNull(row.resolved_at),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `disputes` table. */
export class DisputesRepository extends BaseRepository<Dispute, DisputeInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All disputes in the given status (e.g. currently "open"), newest first. */
  findByStatus(status: DisputeStatus): Promise<Result<readonly Dispute[]>> {
    return this.find({
      filters: [{ column: "status", op: "eq", value: status }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All disputes opened by the given address. */
  findByOpener(opener: string): Promise<Result<readonly Dispute[]>> {
    return this.find({ filters: [{ column: "opener", op: "eq", value: opener }] });
  }
}

/** Factory: build a `DisputesRepository` over the (possibly null) client. */
export function createDisputesRepository(
  client: SupabaseClient | null,
): DisputesRepository {
  return new DisputesRepository(client);
}

function toInt(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeTimestampOrNull(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  return normalizeTimestamp(value);
}
