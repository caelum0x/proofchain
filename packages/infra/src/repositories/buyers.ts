/**
 * Buyers repository — typed data access for the `buyers` identity table (M3).
 * See `deals.ts` for the fill convention; never hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Fields accepted when creating/upserting a buyer. */
export const BuyerInput = z.object({
  address: AddressHex,
  name: z.string().nullable().optional(),
  uri: z.string().nullable().optional(),
  orgId: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type BuyerInput = z.infer<typeof BuyerInput>;

/** A buyer row as stored/returned. */
export const Buyer = z.object({
  address: AddressHex,
  name: z.string().nullable(),
  uri: z.string().nullable(),
  orgId: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Buyer = z.infer<typeof Buyer>;

const config: RepositoryConfig<Buyer, BuyerInput> = {
  table: "buyers",
  primaryKey: "address",
  entitySchema: Buyer,
  insertSchema: BuyerInput,
  toRow: (b) => ({
    address: b.address,
    name: b.name ?? null,
    uri: b.uri ?? null,
    org_id: b.orgId ?? null,
    metadata: b.metadata ?? {},
  }),
  fromRow: (row) => ({
    address: row.address,
    name: row.name ?? null,
    uri: row.uri ?? null,
    orgId: row.org_id ?? null,
    metadata: row.metadata ?? {},
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `buyers` table. */
export class BuyersRepository extends BaseRepository<Buyer, BuyerInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All buyers belonging to the given organization. */
  findByOrg(orgId: string): Promise<Result<readonly Buyer[]>> {
    return this.find({
      filters: [{ column: "org_id", op: "eq", value: orgId }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }
}

/** Factory: build a `BuyersRepository` over the (possibly null) client. */
export function createBuyersRepository(
  client: SupabaseClient | null,
): BuyersRepository {
  return new BuyersRepository(client);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
