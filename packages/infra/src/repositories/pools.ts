/**
 * Pools repository — typed data access for the `pools` table (M5 liquidity /
 * financing pools, ERC4626-style share accounting). See `deals.ts` for the fill
 * convention; never hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Uint256String } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Fields accepted when creating/upserting a pool. */
export const PoolInput = z.object({
  id: z.string().min(1),
  manager: AddressHex.nullable().optional(),
  totalAssets: Uint256String.optional(),
  totalShares: Uint256String.optional(),
  riskGrade: z.number().int().min(0).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type PoolInput = z.infer<typeof PoolInput>;

/** A pool row as stored/returned. */
export const Pool = z.object({
  id: z.string(),
  manager: AddressHex.nullable(),
  totalAssets: Uint256String,
  totalShares: Uint256String,
  riskGrade: z.number().int().min(0).nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Pool = z.infer<typeof Pool>;

const config: RepositoryConfig<Pool, PoolInput> = {
  table: "pools",
  primaryKey: "id",
  entitySchema: Pool,
  insertSchema: PoolInput,
  toRow: (p) => ({
    id: p.id,
    manager: p.manager ?? null,
    total_assets: p.totalAssets ?? "0",
    total_shares: p.totalShares ?? "0",
    risk_grade: p.riskGrade ?? null,
    metadata: p.metadata ?? {},
  }),
  fromRow: (row) => ({
    id: row.id,
    manager: row.manager ?? null,
    totalAssets: toAmount(row.total_assets),
    totalShares: toAmount(row.total_shares),
    riskGrade:
      row.risk_grade === null || row.risk_grade === undefined
        ? null
        : toInt(row.risk_grade),
    metadata: row.metadata ?? {},
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `pools` table. */
export class PoolsRepository extends BaseRepository<Pool, PoolInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All pools operated by the given manager. */
  findByManager(manager: string): Promise<Result<readonly Pool[]>> {
    return this.find({
      filters: [{ column: "manager", op: "eq", value: manager }],
    });
  }

  /** All pools at the given risk grade. */
  findByRiskGrade(riskGrade: number): Promise<Result<readonly Pool[]>> {
    return this.find({
      filters: [{ column: "risk_grade", op: "eq", value: riskGrade }],
    });
  }
}

/** Factory: build a `PoolsRepository` over the (possibly null) client. */
export function createPoolsRepository(
  client: SupabaseClient | null,
): PoolsRepository {
  return new PoolsRepository(client);
}

function toAmount(value: unknown): string {
  return value === null || value === undefined ? "0" : String(value);
}

function toInt(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
