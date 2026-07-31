/**
 * Lab tests repository — typed data access for the `lab_tests` attestation table
 * (data/oracle layer). See `deals.ts` for the fill convention; never hand-edit
 * `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Bytes32Hex } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Lab test outcome states (mirrors the schema CHECK constraint). */
export const LabTestResult = z.enum(["pending", "passed", "failed"]);
export type LabTestResult = z.infer<typeof LabTestResult>;

/** Fields accepted when creating/upserting a lab test. */
export const LabTestInput = z.object({
  id: z.string().min(1),
  batchId: Bytes32Hex.nullable().optional(),
  lab: AddressHex.nullable().optional(),
  testType: z.string().nullable().optional(),
  result: LabTestResult.optional(),
  reportHash: Bytes32Hex.nullable().optional(),
  reportUri: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type LabTestInput = z.infer<typeof LabTestInput>;

/** A lab test row as stored/returned. */
export const LabTest = z.object({
  id: z.string(),
  batchId: Bytes32Hex.nullable(),
  lab: AddressHex.nullable(),
  testType: z.string().nullable(),
  result: LabTestResult,
  reportHash: Bytes32Hex.nullable(),
  reportUri: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LabTest = z.infer<typeof LabTest>;

const config: RepositoryConfig<LabTest, LabTestInput> = {
  table: "lab_tests",
  primaryKey: "id",
  entitySchema: LabTest,
  insertSchema: LabTestInput,
  toRow: (t) => ({
    id: t.id,
    batch_id: t.batchId ?? null,
    lab: t.lab ?? null,
    test_type: t.testType ?? null,
    result: t.result ?? "pending",
    report_hash: t.reportHash ?? null,
    report_uri: t.reportUri ?? null,
    metadata: t.metadata ?? {},
  }),
  fromRow: (row) => ({
    id: row.id,
    batchId: row.batch_id ?? null,
    lab: row.lab ?? null,
    testType: row.test_type ?? null,
    result: row.result,
    reportHash: row.report_hash ?? null,
    reportUri: row.report_uri ?? null,
    metadata: row.metadata ?? {},
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `lab_tests` table. */
export class LabTestsRepository extends BaseRepository<LabTest, LabTestInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All lab tests for the given batch, newest first. */
  findByBatch(batchId: string): Promise<Result<readonly LabTest[]>> {
    return this.find({
      filters: [{ column: "batch_id", op: "eq", value: batchId }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All lab tests performed by the given lab. */
  findByLab(lab: string): Promise<Result<readonly LabTest[]>> {
    return this.find({ filters: [{ column: "lab", op: "eq", value: lab }] });
  }

  /** All lab tests with the given outcome (e.g. "failed"). */
  findByResult(result: LabTestResult): Promise<Result<readonly LabTest[]>> {
    return this.find({ filters: [{ column: "result", op: "eq", value: result }] });
  }
}

/** Factory: build a `LabTestsRepository` over the (possibly null) client. */
export function createLabTestsRepository(
  client: SupabaseClient | null,
): LabTestsRepository {
  return new LabTestsRepository(client);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
