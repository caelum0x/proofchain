/**
 * Receivables repository — typed data access for the `receivables` table (M5
 * tokenized invoices / RWA). See `deals.ts` for the fill convention; never
 * hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Bytes32Hex, Uint256String } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Fields accepted when creating/upserting a receivable. */
export const ReceivableInput = z.object({
  batchId: Bytes32Hex,
  tokenId: Uint256String.nullable().optional(),
  obligor: AddressHex.nullable().optional(),
  holder: AddressHex.nullable().optional(),
  faceValue: Uint256String.nullable().optional(),
  due: z.string().nullable().optional(),
  status: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type ReceivableInput = z.infer<typeof ReceivableInput>;

/** A receivable row as stored/returned. */
export const Receivable = z.object({
  batchId: Bytes32Hex,
  tokenId: Uint256String.nullable(),
  obligor: AddressHex.nullable(),
  holder: AddressHex.nullable(),
  faceValue: Uint256String.nullable(),
  due: z.string().nullable(),
  status: z.string(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Receivable = z.infer<typeof Receivable>;

const config: RepositoryConfig<Receivable, ReceivableInput> = {
  table: "receivables",
  primaryKey: "batch_id",
  entitySchema: Receivable,
  insertSchema: ReceivableInput,
  toRow: (r) => ({
    batch_id: r.batchId,
    token_id: r.tokenId ?? null,
    obligor: r.obligor ?? null,
    holder: r.holder ?? null,
    face_value: r.faceValue ?? null,
    due: r.due ?? null,
    status: r.status ?? "registered",
    metadata: r.metadata ?? {},
  }),
  fromRow: (row) => ({
    batchId: row.batch_id,
    tokenId: toAmountOrNull(row.token_id),
    obligor: row.obligor ?? null,
    holder: row.holder ?? null,
    faceValue: toAmountOrNull(row.face_value),
    due: normalizeTimestamp(row.due) ?? null,
    status: row.status,
    metadata: row.metadata ?? {},
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `receivables` table. */
export class ReceivablesRepository extends BaseRepository<
  Receivable,
  ReceivableInput
> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All receivables currently held by the given address, newest first. */
  findByHolder(holder: string): Promise<Result<readonly Receivable[]>> {
    return this.find({
      filters: [{ column: "holder", op: "eq", value: holder }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All receivables owed by the given obligor. */
  findByObligor(obligor: string): Promise<Result<readonly Receivable[]>> {
    return this.find({
      filters: [{ column: "obligor", op: "eq", value: obligor }],
    });
  }

  /** All receivables in the given lifecycle status. */
  findByStatus(status: string): Promise<Result<readonly Receivable[]>> {
    return this.find({ filters: [{ column: "status", op: "eq", value: status }] });
  }
}

/** Factory: build a `ReceivablesRepository` over the (possibly null) client. */
export function createReceivablesRepository(
  client: SupabaseClient | null,
): ReceivablesRepository {
  return new ReceivablesRepository(client);
}

function toAmountOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
