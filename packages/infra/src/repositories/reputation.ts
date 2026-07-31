/**
 * Reputation repository — typed data access for the `reputation` table (M4
 * supplier scorecards). See `deals.ts` for the fill convention; never hand-edit
 * `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, BasisPoints } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Fields accepted when creating/upserting a reputation record. */
export const ReputationInput = z.object({
  supplier: AddressHex,
  avgScoreBps: BasisPoints.optional(),
  totalDeals: z.number().int().min(0).optional(),
  passRateBps: BasisPoints.optional(),
  disputes: z.number().int().min(0).optional(),
  grade: z.number().int().min(0).nullable().optional(),
});
export type ReputationInput = z.infer<typeof ReputationInput>;

/** A reputation row as stored/returned. */
export const Reputation = z.object({
  supplier: AddressHex,
  avgScoreBps: BasisPoints,
  totalDeals: z.number().int().min(0),
  passRateBps: BasisPoints,
  disputes: z.number().int().min(0),
  grade: z.number().int().min(0).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Reputation = z.infer<typeof Reputation>;

const config: RepositoryConfig<Reputation, ReputationInput> = {
  table: "reputation",
  primaryKey: "supplier",
  entitySchema: Reputation,
  insertSchema: ReputationInput,
  toRow: (r) => ({
    supplier: r.supplier,
    avg_score_bps: r.avgScoreBps ?? 0,
    total_deals: r.totalDeals ?? 0,
    pass_rate_bps: r.passRateBps ?? 0,
    disputes: r.disputes ?? 0,
    grade: r.grade ?? null,
  }),
  fromRow: (row) => ({
    supplier: row.supplier,
    avgScoreBps: toInt(row.avg_score_bps),
    totalDeals: toInt(row.total_deals),
    passRateBps: toInt(row.pass_rate_bps),
    disputes: toInt(row.disputes),
    grade: row.grade === null || row.grade === undefined ? null : toInt(row.grade),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `reputation` table. */
export class ReputationRepository extends BaseRepository<
  Reputation,
  ReputationInput
> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All suppliers at the given credit grade. */
  findByGrade(grade: number): Promise<Result<readonly Reputation[]>> {
    return this.find({ filters: [{ column: "grade", op: "eq", value: grade }] });
  }

  /** Highest-scoring suppliers first (leaderboard), capped at `limit`. */
  topByScore(limit = 20): Promise<Result<readonly Reputation[]>> {
    return this.find({
      orderBy: { column: "avg_score_bps", ascending: false },
      limit,
    });
  }

  /** All suppliers whose average score is at or above the bps threshold. */
  findAboveScore(minBps: number): Promise<Result<readonly Reputation[]>> {
    return this.find({
      filters: [{ column: "avg_score_bps", op: "gte", value: minBps }],
      orderBy: { column: "avg_score_bps", ascending: false },
    });
  }
}

/** Factory: build a `ReputationRepository` over the (possibly null) client. */
export function createReputationRepository(
  client: SupabaseClient | null,
): ReputationRepository {
  return new ReputationRepository(client);
}

function toInt(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
