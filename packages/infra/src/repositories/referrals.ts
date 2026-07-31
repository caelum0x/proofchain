/**
 * Referrals repository — typed data access for the `referrals` growth table.
 * Tracks referrer/referee relationships and reward owed on conversion. See
 * `deals.ts` for the fill convention; never hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Uint256String } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Referral lifecycle states (mirrors the schema CHECK constraint). */
export const ReferralStatus = z.enum([
  "pending",
  "converted",
  "rewarded",
  "expired",
]);
export type ReferralStatus = z.infer<typeof ReferralStatus>;

/** Fields accepted when creating/upserting a referral. */
export const ReferralInput = z.object({
  id: z.string().min(1),
  referrer: AddressHex,
  referee: AddressHex.nullable().optional(),
  code: z.string().nullable().optional(),
  status: ReferralStatus.optional(),
  rewardAmount: Uint256String.optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type ReferralInput = z.infer<typeof ReferralInput>;

/** A referral row as stored/returned. */
export const Referral = z.object({
  id: z.string(),
  referrer: AddressHex,
  referee: AddressHex.nullable(),
  code: z.string().nullable(),
  status: ReferralStatus,
  rewardAmount: Uint256String,
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Referral = z.infer<typeof Referral>;

const config: RepositoryConfig<Referral, ReferralInput> = {
  table: "referrals",
  primaryKey: "id",
  entitySchema: Referral,
  insertSchema: ReferralInput,
  toRow: (r) => ({
    id: r.id,
    referrer: r.referrer,
    referee: r.referee ?? null,
    code: r.code ?? null,
    status: r.status ?? "pending",
    reward_amount: r.rewardAmount ?? "0",
    metadata: r.metadata ?? {},
  }),
  fromRow: (row) => ({
    id: row.id,
    referrer: row.referrer,
    referee: row.referee ?? null,
    code: row.code ?? null,
    status: row.status,
    rewardAmount: toAmount(row.reward_amount),
    metadata: row.metadata ?? {},
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `referrals` table. */
export class ReferralsRepository extends BaseRepository<Referral, ReferralInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All referrals made by the given referrer, newest first. */
  findByReferrer(referrer: string): Promise<Result<readonly Referral[]>> {
    return this.find({
      filters: [{ column: "referrer", op: "eq", value: referrer }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** The referral that brought in the given referee, if any. */
  findByReferee(referee: string): Promise<Result<Referral | null>> {
    return this.findOne("referee", referee);
  }

  /** The referral bound to the given invite code, if any. */
  findByCode(code: string): Promise<Result<Referral | null>> {
    return this.findOne("code", code);
  }

  /** All referrals in the given lifecycle status. */
  findByStatus(status: ReferralStatus): Promise<Result<readonly Referral[]>> {
    return this.find({ filters: [{ column: "status", op: "eq", value: status }] });
  }
}

/** Factory: build a `ReferralsRepository` over the (possibly null) client. */
export function createReferralsRepository(
  client: SupabaseClient | null,
): ReferralsRepository {
  return new ReferralsRepository(client);
}

function toAmount(value: unknown): string {
  return value === null || value === undefined ? "0" : String(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
