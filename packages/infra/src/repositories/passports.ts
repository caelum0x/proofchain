/**
 * Passports repository — typed data access for the `passports` Digital Product
 * Passport (DPP) read model. Keyed by `token_id` (a uint256 base-10 string,
 * mirroring the on-chain ERC721). See `deals.ts` for the fill convention; never
 * hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Bytes32Hex, Uint256String } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** DPP lifecycle states (mirrors the schema CHECK constraint). */
export const PassportStatus = z.enum([
  "draft",
  "issued",
  "active",
  "recycled",
  "retired",
]);
export type PassportStatus = z.infer<typeof PassportStatus>;

/** Fields accepted when creating/upserting a passport. */
export const PassportInput = z.object({
  tokenId: Uint256String,
  batchId: Bytes32Hex.nullable().optional(),
  owner: AddressHex.nullable().optional(),
  productName: z.string().nullable().optional(),
  status: PassportStatus.optional(),
  dataUri: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type PassportInput = z.infer<typeof PassportInput>;

/** A passport row as stored/returned. */
export const Passport = z.object({
  tokenId: Uint256String,
  batchId: Bytes32Hex.nullable(),
  owner: AddressHex.nullable(),
  productName: z.string().nullable(),
  status: PassportStatus,
  dataUri: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Passport = z.infer<typeof Passport>;

const config: RepositoryConfig<Passport, PassportInput> = {
  table: "passports",
  primaryKey: "token_id",
  entitySchema: Passport,
  insertSchema: PassportInput,
  toRow: (p) => ({
    token_id: p.tokenId,
    batch_id: p.batchId ?? null,
    owner: p.owner ?? null,
    product_name: p.productName ?? null,
    status: p.status ?? "draft",
    data_uri: p.dataUri ?? null,
    metadata: p.metadata ?? {},
  }),
  fromRow: (row) => ({
    tokenId: String(row.token_id),
    batchId: row.batch_id ?? null,
    owner: row.owner ?? null,
    productName: row.product_name ?? null,
    status: row.status,
    dataUri: row.data_uri ?? null,
    metadata: row.metadata ?? {},
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `passports` table. */
export class PassportsRepository extends BaseRepository<Passport, PassportInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All passports currently owned by the given address, newest first. */
  findByOwner(owner: string): Promise<Result<readonly Passport[]>> {
    return this.find({
      filters: [{ column: "owner", op: "eq", value: owner }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All passports linked to the given batch. */
  findByBatch(batchId: string): Promise<Result<readonly Passport[]>> {
    return this.find({ filters: [{ column: "batch_id", op: "eq", value: batchId }] });
  }

  /** All passports in the given lifecycle status. */
  findByStatus(status: PassportStatus): Promise<Result<readonly Passport[]>> {
    return this.find({ filters: [{ column: "status", op: "eq", value: status }] });
  }
}

/** Factory: build a `PassportsRepository` over the (possibly null) client. */
export function createPassportsRepository(
  client: SupabaseClient | null,
): PassportsRepository {
  return new PassportsRepository(client);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
