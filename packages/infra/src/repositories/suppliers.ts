/**
 * Suppliers repository — typed data access for the `suppliers` identity table
 * (M3). See `deals.ts` for the fill convention; never hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Fields accepted when creating/upserting a supplier. */
export const SupplierInput = z.object({
  address: AddressHex,
  name: z.string().nullable().optional(),
  uri: z.string().nullable().optional(),
  orgId: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type SupplierInput = z.infer<typeof SupplierInput>;

/** A supplier row as stored/returned. */
export const Supplier = z.object({
  address: AddressHex,
  name: z.string().nullable(),
  uri: z.string().nullable(),
  orgId: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Supplier = z.infer<typeof Supplier>;

const config: RepositoryConfig<Supplier, SupplierInput> = {
  table: "suppliers",
  primaryKey: "address",
  entitySchema: Supplier,
  insertSchema: SupplierInput,
  toRow: (s) => ({
    address: s.address,
    name: s.name ?? null,
    uri: s.uri ?? null,
    org_id: s.orgId ?? null,
    metadata: s.metadata ?? {},
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

/** Typed data access for the `suppliers` table. */
export class SuppliersRepository extends BaseRepository<Supplier, SupplierInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All suppliers belonging to the given organization. */
  findByOrg(orgId: string): Promise<Result<readonly Supplier[]>> {
    return this.find({
      filters: [{ column: "org_id", op: "eq", value: orgId }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }
}

/** Factory: build a `SuppliersRepository` over the (possibly null) client. */
export function createSuppliersRepository(
  client: SupabaseClient | null,
): SuppliersRepository {
  return new SuppliersRepository(client);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
