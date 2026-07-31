/**
 * Bonds repository — typed data access for the `bonds` table (M4 supplier
 * performance bonds / collateral). See `deals.ts` for the fill convention;
 * never hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Uint256String } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Bond lifecycle states (mirrors the schema CHECK constraint). */
export const BondStatus = z.enum(["active", "withdrawn", "slashed"]);
export type BondStatus = z.infer<typeof BondStatus>;

/** Fields accepted when creating/upserting a bond. */
export const BondInput = z.object({
  supplier: AddressHex,
  token: AddressHex.nullable().optional(),
  amount: Uint256String.optional(),
  locked: Uint256String.optional(),
  status: BondStatus.optional(),
});
export type BondInput = z.infer<typeof BondInput>;

/** A bond row as stored/returned. */
export const Bond = z.object({
  supplier: AddressHex,
  token: AddressHex.nullable(),
  amount: Uint256String,
  locked: Uint256String,
  status: BondStatus,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Bond = z.infer<typeof Bond>;

const config: RepositoryConfig<Bond, BondInput> = {
  table: "bonds",
  primaryKey: "supplier",
  entitySchema: Bond,
  insertSchema: BondInput,
  toRow: (b) => ({
    supplier: b.supplier,
    token: b.token ?? null,
    amount: b.amount ?? "0",
    locked: b.locked ?? "0",
    status: b.status ?? "active",
  }),
  fromRow: (row) => ({
    supplier: row.supplier,
    token: row.token ?? null,
    amount: toAmount(row.amount),
    locked: toAmount(row.locked),
    status: row.status,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `bonds` table. */
export class BondsRepository extends BaseRepository<Bond, BondInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All bonds in the given lifecycle status. */
  findByStatus(status: BondStatus): Promise<Result<readonly Bond[]>> {
    return this.find({ filters: [{ column: "status", op: "eq", value: status }] });
  }

  /** All bonds collateralized in the given token. */
  findByToken(token: string): Promise<Result<readonly Bond[]>> {
    return this.find({ filters: [{ column: "token", op: "eq", value: token }] });
  }
}

/** Factory: build a `BondsRepository` over the (possibly null) client. */
export function createBondsRepository(
  client: SupabaseClient | null,
): BondsRepository {
  return new BondsRepository(client);
}

function toAmount(value: unknown): string {
  return value === null || value === undefined ? "0" : String(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
