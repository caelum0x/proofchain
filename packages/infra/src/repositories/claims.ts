/**
 * Claims repository — typed data access for the `claims` insurance table
 * (M6, claims filed against a policy). See `deals.ts` for the fill convention;
 * never hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Bytes32Hex, Uint256String } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Claim lifecycle states (mirrors the schema CHECK constraint). */
export const ClaimStatus = z.enum(["filed", "approved", "paid", "rejected"]);
export type ClaimStatus = z.infer<typeof ClaimStatus>;

/** Fields accepted when creating/upserting a claim. */
export const ClaimInput = z.object({
  id: z.string().min(1),
  policyId: z.string().nullable().optional(),
  batchId: Bytes32Hex.nullable().optional(),
  claimant: AddressHex.nullable().optional(),
  amount: Uint256String.optional(),
  status: ClaimStatus.optional(),
});
export type ClaimInput = z.infer<typeof ClaimInput>;

/** A claim row as stored/returned. */
export const Claim = z.object({
  id: z.string(),
  policyId: z.string().nullable(),
  batchId: Bytes32Hex.nullable(),
  claimant: AddressHex.nullable(),
  amount: Uint256String,
  status: ClaimStatus,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Claim = z.infer<typeof Claim>;

const config: RepositoryConfig<Claim, ClaimInput> = {
  table: "claims",
  primaryKey: "id",
  entitySchema: Claim,
  insertSchema: ClaimInput,
  toRow: (c) => ({
    id: c.id,
    policy_id: c.policyId ?? null,
    batch_id: c.batchId ?? null,
    claimant: c.claimant ?? null,
    amount: c.amount ?? "0",
    status: c.status ?? "filed",
  }),
  fromRow: (row) => ({
    id: row.id,
    policyId: row.policy_id ?? null,
    batchId: row.batch_id ?? null,
    claimant: row.claimant ?? null,
    amount: toAmount(row.amount),
    status: row.status,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `claims` table. */
export class ClaimsRepository extends BaseRepository<Claim, ClaimInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All claims filed against the given policy. */
  findByPolicy(policyId: string): Promise<Result<readonly Claim[]>> {
    return this.find({
      filters: [{ column: "policy_id", op: "eq", value: policyId }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All claims filed by the given claimant. */
  findByClaimant(claimant: string): Promise<Result<readonly Claim[]>> {
    return this.find({ filters: [{ column: "claimant", op: "eq", value: claimant }] });
  }

  /** All claims in the given lifecycle status. */
  findByStatus(status: ClaimStatus): Promise<Result<readonly Claim[]>> {
    return this.find({
      filters: [{ column: "status", op: "eq", value: status }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }
}

/** Factory: build a `ClaimsRepository` over the (possibly null) client. */
export function createClaimsRepository(
  client: SupabaseClient | null,
): ClaimsRepository {
  return new ClaimsRepository(client);
}

function toAmount(value: unknown): string {
  return value === null || value === undefined ? "0" : String(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
