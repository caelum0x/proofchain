/**
 * Policies repository — typed data access for the `policies` insurance table
 * (M6 parametric/cargo insurance). See `deals.ts` for the fill convention;
 * never hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Bytes32Hex, Uint256String } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Policy lifecycle states (mirrors the schema CHECK constraint). */
export const PolicyStatus = z.enum(["active", "expired", "claimed", "cancelled"]);
export type PolicyStatus = z.infer<typeof PolicyStatus>;

/** Fields accepted when creating/upserting a policy. */
export const PolicyInput = z.object({
  id: z.string().min(1),
  batchId: Bytes32Hex.nullable().optional(),
  holder: AddressHex.nullable().optional(),
  coverage: Uint256String.optional(),
  premium: Uint256String.optional(),
  status: PolicyStatus.optional(),
});
export type PolicyInput = z.infer<typeof PolicyInput>;

/** A policy row as stored/returned. */
export const Policy = z.object({
  id: z.string(),
  batchId: Bytes32Hex.nullable(),
  holder: AddressHex.nullable(),
  coverage: Uint256String,
  premium: Uint256String,
  status: PolicyStatus,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Policy = z.infer<typeof Policy>;

const config: RepositoryConfig<Policy, PolicyInput> = {
  table: "policies",
  primaryKey: "id",
  entitySchema: Policy,
  insertSchema: PolicyInput,
  toRow: (p) => ({
    id: p.id,
    batch_id: p.batchId ?? null,
    holder: p.holder ?? null,
    coverage: p.coverage ?? "0",
    premium: p.premium ?? "0",
    status: p.status ?? "active",
  }),
  fromRow: (row) => ({
    id: row.id,
    batchId: row.batch_id ?? null,
    holder: row.holder ?? null,
    coverage: toAmount(row.coverage),
    premium: toAmount(row.premium),
    status: row.status,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `policies` table. */
export class PoliciesRepository extends BaseRepository<Policy, PolicyInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All policies held by the given address, newest first. */
  findByHolder(holder: string): Promise<Result<readonly Policy[]>> {
    return this.find({
      filters: [{ column: "holder", op: "eq", value: holder }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All policies covering the given batch. */
  findByBatch(batchId: string): Promise<Result<readonly Policy[]>> {
    return this.find({ filters: [{ column: "batch_id", op: "eq", value: batchId }] });
  }

  /** All policies in the given lifecycle status. */
  findByStatus(status: PolicyStatus): Promise<Result<readonly Policy[]>> {
    return this.find({
      filters: [{ column: "status", op: "eq", value: status }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }
}

/** Factory: build a `PoliciesRepository` over the (possibly null) client. */
export function createPoliciesRepository(
  client: SupabaseClient | null,
): PoliciesRepository {
  return new PoliciesRepository(client);
}

function toAmount(value: unknown): string {
  return value === null || value === undefined ? "0" : String(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
