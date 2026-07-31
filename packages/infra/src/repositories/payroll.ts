/**
 * Payroll repository — typed data access for the `payroll` workforce table
 * (milestone-gated worker stablecoin payouts). See `deals.ts` for the fill
 * convention; never hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Uint256String } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Payroll lifecycle states (mirrors the schema CHECK constraint). */
export const PayrollStatus = z.enum([
  "pending",
  "approved",
  "paid",
  "cancelled",
]);
export type PayrollStatus = z.infer<typeof PayrollStatus>;

/** Fields accepted when creating/upserting a payroll entry. */
export const PayrollInput = z.object({
  id: z.string().min(1),
  worker: AddressHex,
  employer: AddressHex.nullable().optional(),
  token: AddressHex.nullable().optional(),
  amount: Uint256String.optional(),
  milestone: z.string().nullable().optional(),
  status: PayrollStatus.optional(),
  paidAt: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type PayrollInput = z.infer<typeof PayrollInput>;

/** A payroll row as stored/returned. */
export const Payroll = z.object({
  id: z.string(),
  worker: AddressHex,
  employer: AddressHex.nullable(),
  token: AddressHex.nullable(),
  amount: Uint256String,
  milestone: z.string().nullable(),
  status: PayrollStatus,
  paidAt: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Payroll = z.infer<typeof Payroll>;

const config: RepositoryConfig<Payroll, PayrollInput> = {
  table: "payroll",
  primaryKey: "id",
  entitySchema: Payroll,
  insertSchema: PayrollInput,
  toRow: (p) => ({
    id: p.id,
    worker: p.worker,
    employer: p.employer ?? null,
    token: p.token ?? null,
    amount: p.amount ?? "0",
    milestone: p.milestone ?? null,
    status: p.status ?? "pending",
    paid_at: p.paidAt ?? null,
    metadata: p.metadata ?? {},
  }),
  fromRow: (row) => ({
    id: row.id,
    worker: row.worker,
    employer: row.employer ?? null,
    token: row.token ?? null,
    amount: toAmount(row.amount),
    milestone: row.milestone ?? null,
    status: row.status,
    paidAt: normalizeTimestampOrNull(row.paid_at),
    metadata: row.metadata ?? {},
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `payroll` table. */
export class PayrollRepository extends BaseRepository<Payroll, PayrollInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All payroll entries owed to the given worker, newest first. */
  findByWorker(worker: string): Promise<Result<readonly Payroll[]>> {
    return this.find({
      filters: [{ column: "worker", op: "eq", value: worker }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All payroll entries funded by the given employer. */
  findByEmployer(employer: string): Promise<Result<readonly Payroll[]>> {
    return this.find({ filters: [{ column: "employer", op: "eq", value: employer }] });
  }

  /** All payroll entries in the given status (e.g. "pending" payouts). */
  findByStatus(status: PayrollStatus): Promise<Result<readonly Payroll[]>> {
    return this.find({
      filters: [{ column: "status", op: "eq", value: status }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }
}

/** Factory: build a `PayrollRepository` over the (possibly null) client. */
export function createPayrollRepository(
  client: SupabaseClient | null,
): PayrollRepository {
  return new PayrollRepository(client);
}

function toAmount(value: unknown): string {
  return value === null || value === undefined ? "0" : String(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeTimestampOrNull(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  return normalizeTimestamp(value);
}
