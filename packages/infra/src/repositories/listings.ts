/**
 * Listings repository — typed data access for the `listings` marketplace table
 * (M9). See `deals.ts` for the fill convention; never hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Uint256String } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Listing lifecycle states (mirrors the schema CHECK constraint). */
export const ListingStatus = z.enum(["active", "cancelled", "filled"]);
export type ListingStatus = z.infer<typeof ListingStatus>;

/** Fields accepted when creating/upserting a listing. */
export const ListingInput = z.object({
  id: z.string().min(1),
  kind: z.string().nullable().optional(),
  asset: z.string().nullable().optional(),
  seller: AddressHex.nullable().optional(),
  price: Uint256String.nullable().optional(),
  status: ListingStatus.optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type ListingInput = z.infer<typeof ListingInput>;

/** A listing row as stored/returned. */
export const Listing = z.object({
  id: z.string(),
  kind: z.string().nullable(),
  asset: z.string().nullable(),
  seller: AddressHex.nullable(),
  price: Uint256String.nullable(),
  status: ListingStatus,
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Listing = z.infer<typeof Listing>;

const config: RepositoryConfig<Listing, ListingInput> = {
  table: "listings",
  primaryKey: "id",
  entitySchema: Listing,
  insertSchema: ListingInput,
  toRow: (l) => ({
    id: l.id,
    kind: l.kind ?? null,
    asset: l.asset ?? null,
    seller: l.seller ?? null,
    price: l.price ?? null,
    status: l.status ?? "active",
    metadata: l.metadata ?? {},
  }),
  fromRow: (row) => ({
    id: row.id,
    kind: row.kind ?? null,
    asset: row.asset ?? null,
    seller: row.seller ?? null,
    price: toAmountOrNull(row.price),
    status: row.status,
    metadata: row.metadata ?? {},
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `listings` table. */
export class ListingsRepository extends BaseRepository<Listing, ListingInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All listings created by the given seller, newest first. */
  findBySeller(seller: string): Promise<Result<readonly Listing[]>> {
    return this.find({
      filters: [{ column: "seller", op: "eq", value: seller }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All listings in the given status (e.g. open "active" offers). */
  findByStatus(status: ListingStatus): Promise<Result<readonly Listing[]>> {
    return this.find({
      filters: [{ column: "status", op: "eq", value: status }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All listings of the given kind (e.g. "fixed_price", "offer"). */
  findByKind(kind: string): Promise<Result<readonly Listing[]>> {
    return this.find({ filters: [{ column: "kind", op: "eq", value: kind }] });
  }
}

/** Factory: build a `ListingsRepository` over the (possibly null) client. */
export function createListingsRepository(
  client: SupabaseClient | null,
): ListingsRepository {
  return new ListingsRepository(client);
}

function toAmountOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
