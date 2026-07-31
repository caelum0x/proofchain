/**
 * KYC repository — typed data access for the `kyc` table (M3 identity levels).
 * See `deals.ts` for the fill convention; never hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Fields accepted when creating/upserting a KYC record. */
export const KycInput = z.object({
  address: AddressHex,
  level: z.number().int().min(0).optional(),
  provider: AddressHex.nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type KycInput = z.infer<typeof KycInput>;

/** A KYC row as stored/returned. */
export const Kyc = z.object({
  address: AddressHex,
  level: z.number().int().min(0),
  provider: AddressHex.nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Kyc = z.infer<typeof Kyc>;

const config: RepositoryConfig<Kyc, KycInput> = {
  table: "kyc",
  primaryKey: "address",
  entitySchema: Kyc,
  insertSchema: KycInput,
  toRow: (k) => ({
    address: k.address,
    level: k.level ?? 0,
    provider: k.provider ?? null,
    metadata: k.metadata ?? {},
  }),
  fromRow: (row) => ({
    address: row.address,
    level: toInt(row.level),
    provider: row.provider ?? null,
    metadata: row.metadata ?? {},
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `kyc` table. */
export class KycRepository extends BaseRepository<Kyc, KycInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All records at or above the given KYC level (e.g. gate access by tier). */
  findByMinLevel(level: number): Promise<Result<readonly Kyc[]>> {
    return this.find({
      filters: [{ column: "level", op: "gte", value: level }],
      orderBy: { column: "level", ascending: false },
    });
  }

  /** All records attested by the given KYC provider. */
  findByProvider(provider: string): Promise<Result<readonly Kyc[]>> {
    return this.find({
      filters: [{ column: "provider", op: "eq", value: provider }],
    });
  }
}

/** Factory: build a `KycRepository` over the (possibly null) client. */
export function createKycRepository(
  client: SupabaseClient | null,
): KycRepository {
  return new KycRepository(client);
}

function toInt(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
