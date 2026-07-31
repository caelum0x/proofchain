/**
 * Carbon repository — typed data access for the `carbon` credits table (M8
 * tokenization & ESG). Tracks tonnes of CO2e issued and retired per project /
 * batch. See `deals.ts` for the fill convention; never hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { Bytes32Hex, Uint256String } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Fields accepted when creating/upserting a carbon record. */
export const CarbonInput = z.object({
  id: z.string().min(1),
  projectId: z.string().nullable().optional(),
  batchId: Bytes32Hex.nullable().optional(),
  co2e: Uint256String.optional(),
  retired: Uint256String.optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CarbonInput = z.infer<typeof CarbonInput>;

/** A carbon record row as stored/returned. */
export const Carbon = z.object({
  id: z.string(),
  projectId: z.string().nullable(),
  batchId: Bytes32Hex.nullable(),
  co2e: Uint256String,
  retired: Uint256String,
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Carbon = z.infer<typeof Carbon>;

const config: RepositoryConfig<Carbon, CarbonInput> = {
  table: "carbon",
  primaryKey: "id",
  entitySchema: Carbon,
  insertSchema: CarbonInput,
  toRow: (c) => ({
    id: c.id,
    project_id: c.projectId ?? null,
    batch_id: c.batchId ?? null,
    co2e: c.co2e,
    retired: c.retired,
    metadata: c.metadata ?? {},
  }),
  fromRow: (row) => ({
    id: row.id,
    projectId: row.project_id ?? null,
    batchId: row.batch_id ?? null,
    co2e: toAmount(row.co2e),
    retired: toAmount(row.retired),
    metadata: row.metadata ?? {},
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `carbon` table. */
export class CarbonRepository extends BaseRepository<Carbon, CarbonInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All carbon records for the given project, newest first. */
  findByProject(projectId: string): Promise<Result<readonly Carbon[]>> {
    return this.find({
      filters: [{ column: "project_id", op: "eq", value: projectId }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All carbon records tied to the given batch. */
  findByBatch(batchId: string): Promise<Result<readonly Carbon[]>> {
    return this.find({ filters: [{ column: "batch_id", op: "eq", value: batchId }] });
  }
}

/** Factory: build a `CarbonRepository` over the (possibly null) client. */
export function createCarbonRepository(
  client: SupabaseClient | null,
): CarbonRepository {
  return new CarbonRepository(client);
}

function toAmount(value: unknown): string {
  return value === null || value === undefined ? "0" : String(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
