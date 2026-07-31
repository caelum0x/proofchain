/**
 * Financing listings repository — typed data access for the `financing_listings`
 * table (M5 invoice-financing marketplace). See `deals.ts` for the fill
 * convention; never hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Bytes32Hex, Uint256String } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Financing listing lifecycle states (mirrors the schema CHECK constraint). */
export const FinancingListingStatus = z.enum([
  "listed",
  "funded",
  "claimed",
  "cancelled",
]);
export type FinancingListingStatus = z.infer<typeof FinancingListingStatus>;

/** Fields accepted when creating/upserting a financing listing. */
export const FinancingListingInput = z.object({
  batchId: Bytes32Hex,
  supplier: AddressHex,
  lender: AddressHex.nullable().optional(),
  askAmount: Uint256String.optional(),
  advanceAmount: Uint256String.nullable().optional(),
  status: FinancingListingStatus.optional(),
});
export type FinancingListingInput = z.infer<typeof FinancingListingInput>;

/** A financing listing row as stored/returned. */
export const FinancingListing = z.object({
  batchId: Bytes32Hex,
  supplier: AddressHex,
  lender: AddressHex.nullable(),
  askAmount: Uint256String,
  advanceAmount: Uint256String.nullable(),
  status: FinancingListingStatus,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FinancingListing = z.infer<typeof FinancingListing>;

const config: RepositoryConfig<FinancingListing, FinancingListingInput> = {
  table: "financing_listings",
  primaryKey: "batch_id",
  entitySchema: FinancingListing,
  insertSchema: FinancingListingInput,
  toRow: (l) => ({
    batch_id: l.batchId,
    supplier: l.supplier,
    lender: l.lender ?? null,
    ask_amount: l.askAmount ?? "0",
    advance_amount: l.advanceAmount ?? null,
    status: l.status ?? "listed",
  }),
  fromRow: (row) => ({
    batchId: row.batch_id,
    supplier: row.supplier,
    lender: row.lender ?? null,
    askAmount: toAmount(row.ask_amount),
    advanceAmount: toAmountOrNull(row.advance_amount),
    status: row.status,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `financing_listings` table. */
export class FinancingListingsRepository extends BaseRepository<
  FinancingListing,
  FinancingListingInput
> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All listings created by the given supplier, newest first. */
  findBySupplier(supplier: string): Promise<Result<readonly FinancingListing[]>> {
    return this.find({
      filters: [{ column: "supplier", op: "eq", value: supplier }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All listings funded by the given lender. */
  findByLender(lender: string): Promise<Result<readonly FinancingListing[]>> {
    return this.find({
      filters: [{ column: "lender", op: "eq", value: lender }],
    });
  }

  /** All listings in the given lifecycle status (e.g. open "listed" offers). */
  findByStatus(
    status: FinancingListingStatus,
  ): Promise<Result<readonly FinancingListing[]>> {
    return this.find({
      filters: [{ column: "status", op: "eq", value: status }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }
}

/** Factory: build a `FinancingListingsRepository` over the (possibly null) client. */
export function createFinancingListingsRepository(
  client: SupabaseClient | null,
): FinancingListingsRepository {
  return new FinancingListingsRepository(client);
}

function toAmount(value: unknown): string {
  return value === null || value === undefined ? "0" : String(value);
}

function toAmountOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
