/**
 * Freight repository — typed data access for the `freight` logistics table
 * (freight bookings). See `deals.ts` for the fill convention; never hand-edit
 * `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Bytes32Hex } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Freight lifecycle states (mirrors the schema CHECK constraint). */
export const FreightStatus = z.enum([
  "booked",
  "in_transit",
  "delivered",
  "cancelled",
]);
export type FreightStatus = z.infer<typeof FreightStatus>;

/** Fields accepted when creating/upserting a freight booking. */
export const FreightInput = z.object({
  id: z.string().min(1),
  batchId: Bytes32Hex.nullable().optional(),
  shipper: AddressHex.nullable().optional(),
  carrier: AddressHex.nullable().optional(),
  origin: z.string().nullable().optional(),
  destination: z.string().nullable().optional(),
  status: FreightStatus.optional(),
  eta: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type FreightInput = z.infer<typeof FreightInput>;

/** A freight booking row as stored/returned. */
export const Freight = z.object({
  id: z.string(),
  batchId: Bytes32Hex.nullable(),
  shipper: AddressHex.nullable(),
  carrier: AddressHex.nullable(),
  origin: z.string().nullable(),
  destination: z.string().nullable(),
  status: FreightStatus,
  eta: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Freight = z.infer<typeof Freight>;

const config: RepositoryConfig<Freight, FreightInput> = {
  table: "freight",
  primaryKey: "id",
  entitySchema: Freight,
  insertSchema: FreightInput,
  toRow: (f) => ({
    id: f.id,
    batch_id: f.batchId ?? null,
    shipper: f.shipper ?? null,
    carrier: f.carrier ?? null,
    origin: f.origin ?? null,
    destination: f.destination ?? null,
    status: f.status ?? "booked",
    eta: f.eta ?? null,
    metadata: f.metadata ?? {},
  }),
  fromRow: (row) => ({
    id: row.id,
    batchId: row.batch_id ?? null,
    shipper: row.shipper ?? null,
    carrier: row.carrier ?? null,
    origin: row.origin ?? null,
    destination: row.destination ?? null,
    status: row.status,
    eta: normalizeTimestampOrNull(row.eta),
    metadata: row.metadata ?? {},
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `freight` table. */
export class FreightRepository extends BaseRepository<Freight, FreightInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All freight bookings for the given batch, newest first. */
  findByBatch(batchId: string): Promise<Result<readonly Freight[]>> {
    return this.find({
      filters: [{ column: "batch_id", op: "eq", value: batchId }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All freight bookings assigned to the given carrier. */
  findByCarrier(carrier: string): Promise<Result<readonly Freight[]>> {
    return this.find({ filters: [{ column: "carrier", op: "eq", value: carrier }] });
  }

  /** All freight bookings in the given status (e.g. "in_transit"). */
  findByStatus(status: FreightStatus): Promise<Result<readonly Freight[]>> {
    return this.find({
      filters: [{ column: "status", op: "eq", value: status }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }
}

/** Factory: build a `FreightRepository` over the (possibly null) client. */
export function createFreightRepository(
  client: SupabaseClient | null,
): FreightRepository {
  return new FreightRepository(client);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeTimestampOrNull(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  return normalizeTimestamp(value);
}
