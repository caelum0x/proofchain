/**
 * ESG repository — typed data access for the `esg` scores table (M8
 * tokenization & ESG). See `deals.ts` for the fill convention; never hand-edit
 * `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { BasisPoints } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Fields accepted when creating/upserting an ESG score. */
export const EsgInput = z.object({
  id: z.string().min(1),
  subject: z.string().min(1),
  score: BasisPoints.nullable().optional(),
  uri: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type EsgInput = z.infer<typeof EsgInput>;

/** An ESG score row as stored/returned. */
export const Esg = z.object({
  id: z.string(),
  subject: z.string(),
  score: BasisPoints.nullable(),
  uri: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Esg = z.infer<typeof Esg>;

const config: RepositoryConfig<Esg, EsgInput> = {
  table: "esg",
  primaryKey: "id",
  entitySchema: Esg,
  insertSchema: EsgInput,
  toRow: (e) => ({
    id: e.id,
    subject: e.subject,
    score: e.score ?? null,
    uri: e.uri ?? null,
    metadata: e.metadata ?? {},
  }),
  fromRow: (row) => ({
    id: row.id,
    subject: row.subject,
    score: toIntOrNull(row.score),
    uri: row.uri ?? null,
    metadata: row.metadata ?? {},
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `esg` table. */
export class EsgRepository extends BaseRepository<Esg, EsgInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All ESG scores for the given subject (e.g. a supplier or batch id). */
  findBySubject(subject: string): Promise<Result<readonly Esg[]>> {
    return this.find({
      filters: [{ column: "subject", op: "eq", value: subject }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All ESG scores at or above the given basis-point threshold. */
  findAtLeast(minScore: number): Promise<Result<readonly Esg[]>> {
    return this.find({
      filters: [{ column: "score", op: "gte", value: minScore }],
      orderBy: { column: "score", ascending: false },
    });
  }
}

/** Factory: build an `EsgRepository` over the (possibly null) client. */
export function createEsgRepository(client: SupabaseClient | null): EsgRepository {
  return new EsgRepository(client);
}

function toIntOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
