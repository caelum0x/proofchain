/**
 * Carriers repository — typed data access for the `carriers` identity table
 * (M3, logistics parties). See `deals.ts` for the fill convention; never
 * hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Fields accepted when creating/upserting a carrier. */
export const CarrierInput = z.object({
  address: AddressHex,
  name: z.string().nullable().optional(),
  uri: z.string().nullable().optional(),
  orgId: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CarrierInput = z.infer<typeof CarrierInput>;

/** A carrier row as stored/returned. */
export const Carrier = z.object({
  address: AddressHex,
  name: z.string().nullable(),
  uri: z.string().nullable(),
  orgId: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Carrier = z.infer<typeof Carrier>;

const config: RepositoryConfig<Carrier, CarrierInput> = {
  table: "carriers",
  primaryKey: "address",
  entitySchema: Carrier,
  insertSchema: CarrierInput,
  toRow: (c) => ({
    address: c.address,
    name: c.name ?? null,
    uri: c.uri ?? null,
    org_id: c.orgId ?? null,
    metadata: c.metadata ?? {},
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

/** Typed data access for the `carriers` table. */
export class CarriersRepository extends BaseRepository<Carrier, CarrierInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All carriers belonging to the given organization. */
  findByOrg(orgId: string): Promise<Result<readonly Carrier[]>> {
    return this.find({
      filters: [{ column: "org_id", op: "eq", value: orgId }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }
}

/** Factory: build a `CarriersRepository` over the (possibly null) client. */
export function createCarriersRepository(
  client: SupabaseClient | null,
): CarriersRepository {
  return new CarriersRepository(client);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
