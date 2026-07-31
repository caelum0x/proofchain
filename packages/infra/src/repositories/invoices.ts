/**
 * Invoices repository — typed data access for the `invoices` trade-finance table
 * (commercial invoices that back factoring / PO financing). See `deals.ts` for
 * the fill convention; never hand-edit `index.ts`.
 *
 * The backing table is defined in `schema/12_invoices.sql`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Bytes32Hex, Uint256String } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Invoice lifecycle states (mirrors the schema CHECK constraint). */
export const InvoiceStatus = z.enum([
  "draft",
  "issued",
  "paid",
  "overdue",
  "cancelled",
  "financed",
]);
export type InvoiceStatus = z.infer<typeof InvoiceStatus>;

/** Fields accepted when creating/upserting an invoice. */
export const InvoiceInput = z.object({
  id: z.string().min(1),
  batchId: Bytes32Hex.nullable().optional(),
  seller: AddressHex,
  buyer: AddressHex.nullable().optional(),
  token: AddressHex.nullable().optional(),
  amount: Uint256String.optional(),
  currency: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  status: InvoiceStatus.optional(),
  uri: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type InvoiceInput = z.infer<typeof InvoiceInput>;

/** An invoice row as stored/returned. */
export const Invoice = z.object({
  id: z.string(),
  batchId: Bytes32Hex.nullable(),
  seller: AddressHex,
  buyer: AddressHex.nullable(),
  token: AddressHex.nullable(),
  amount: Uint256String,
  currency: z.string().nullable(),
  dueDate: z.string().nullable(),
  status: InvoiceStatus,
  uri: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Invoice = z.infer<typeof Invoice>;

const config: RepositoryConfig<Invoice, InvoiceInput> = {
  table: "invoices",
  primaryKey: "id",
  entitySchema: Invoice,
  insertSchema: InvoiceInput,
  toRow: (i) => ({
    id: i.id,
    batch_id: i.batchId ?? null,
    seller: i.seller,
    buyer: i.buyer ?? null,
    token: i.token ?? null,
    amount: i.amount ?? "0",
    currency: i.currency ?? null,
    due_date: i.dueDate ?? null,
    status: i.status ?? "issued",
    uri: i.uri ?? null,
    metadata: i.metadata ?? {},
  }),
  fromRow: (row) => ({
    id: row.id,
    batchId: row.batch_id ?? null,
    seller: row.seller,
    buyer: row.buyer ?? null,
    token: row.token ?? null,
    amount: toAmount(row.amount),
    currency: row.currency ?? null,
    dueDate: normalizeTimestamp(row.due_date) ?? null,
    status: row.status,
    uri: row.uri ?? null,
    metadata: row.metadata ?? {},
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `invoices` table. */
export class InvoicesRepository extends BaseRepository<Invoice, InvoiceInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All invoices issued by the given seller, newest first. */
  findBySeller(seller: string): Promise<Result<readonly Invoice[]>> {
    return this.find({
      filters: [{ column: "seller", op: "eq", value: seller }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All invoices payable by the given buyer, newest first. */
  findByBuyer(buyer: string): Promise<Result<readonly Invoice[]>> {
    return this.find({
      filters: [{ column: "buyer", op: "eq", value: buyer }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All invoices in the given lifecycle status. */
  findByStatus(status: InvoiceStatus): Promise<Result<readonly Invoice[]>> {
    return this.find({ filters: [{ column: "status", op: "eq", value: status }] });
  }

  /** All invoices tied to the given provenance batch. */
  findByBatch(batchId: string): Promise<Result<readonly Invoice[]>> {
    return this.find({
      filters: [{ column: "batch_id", op: "eq", value: batchId }],
    });
  }
}

/** Factory: build an `InvoicesRepository` over the (possibly null) client. */
export function createInvoicesRepository(
  client: SupabaseClient | null,
): InvoicesRepository {
  return new InvoicesRepository(client);
}

function toAmount(value: unknown): string {
  return value === null || value === undefined ? "0" : String(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
