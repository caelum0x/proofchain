/**
 * Inspections repository — typed data access for the `inspections` quality table
 * (data/oracle layer). See `deals.ts` for the fill convention; never hand-edit
 * `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Bytes32Hex, BasisPoints } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Inspection outcome states (mirrors the schema CHECK constraint). */
export const InspectionResult = z.enum(["pending", "passed", "failed", "waived"]);
export type InspectionResult = z.infer<typeof InspectionResult>;

/** Fields accepted when creating/upserting an inspection. */
export const InspectionInput = z.object({
  id: z.string().min(1),
  batchId: Bytes32Hex.nullable().optional(),
  inspector: AddressHex.nullable().optional(),
  inspectionType: z.string().nullable().optional(),
  result: InspectionResult.optional(),
  score: BasisPoints.nullable().optional(),
  reportUri: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type InspectionInput = z.infer<typeof InspectionInput>;

/** An inspection row as stored/returned. */
export const Inspection = z.object({
  id: z.string(),
  batchId: Bytes32Hex.nullable(),
  inspector: AddressHex.nullable(),
  inspectionType: z.string().nullable(),
  result: InspectionResult,
  score: BasisPoints.nullable(),
  reportUri: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Inspection = z.infer<typeof Inspection>;

const config: RepositoryConfig<Inspection, InspectionInput> = {
  table: "inspections",
  primaryKey: "id",
  entitySchema: Inspection,
  insertSchema: InspectionInput,
  toRow: (i) => ({
    id: i.id,
    batch_id: i.batchId ?? null,
    inspector: i.inspector ?? null,
    inspection_type: i.inspectionType ?? null,
    result: i.result ?? "pending",
    score: i.score ?? null,
    report_uri: i.reportUri ?? null,
    metadata: i.metadata ?? {},
  }),
  fromRow: (row) => ({
    id: row.id,
    batchId: row.batch_id ?? null,
    inspector: row.inspector ?? null,
    inspectionType: row.inspection_type ?? null,
    result: row.result,
    score: toIntOrNull(row.score),
    reportUri: row.report_uri ?? null,
    metadata: row.metadata ?? {},
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `inspections` table. */
export class InspectionsRepository extends BaseRepository<
  Inspection,
  InspectionInput
> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All inspections for the given batch, newest first. */
  findByBatch(batchId: string): Promise<Result<readonly Inspection[]>> {
    return this.find({
      filters: [{ column: "batch_id", op: "eq", value: batchId }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All inspections carried out by the given inspector. */
  findByInspector(inspector: string): Promise<Result<readonly Inspection[]>> {
    return this.find({ filters: [{ column: "inspector", op: "eq", value: inspector }] });
  }

  /** All inspections with the given outcome (e.g. "failed"). */
  findByResult(result: InspectionResult): Promise<Result<readonly Inspection[]>> {
    return this.find({ filters: [{ column: "result", op: "eq", value: result }] });
  }
}

/** Factory: build an `InspectionsRepository` over the (possibly null) client. */
export function createInspectionsRepository(
  client: SupabaseClient | null,
): InspectionsRepository {
  return new InspectionsRepository(client);
}

function toIntOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
