/**
 * Rewards repository — typed data access for the `rewards` table (M10 loyalty /
 * incentive programs). See `deals.ts` for the fill convention; never hand-edit
 * `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Uint256String } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Fields accepted when creating/upserting a reward accrual. */
export const RewardInput = z.object({
  id: z.string().min(1),
  account: AddressHex,
  program: z.string().optional(),
  amount: Uint256String.optional(),
  claimed: Uint256String.optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type RewardInput = z.infer<typeof RewardInput>;

/** A reward row as stored/returned. */
export const Reward = z.object({
  id: z.string(),
  account: AddressHex,
  program: z.string(),
  amount: Uint256String,
  claimed: Uint256String,
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Reward = z.infer<typeof Reward>;

const config: RepositoryConfig<Reward, RewardInput> = {
  table: "rewards",
  primaryKey: "id",
  entitySchema: Reward,
  insertSchema: RewardInput,
  toRow: (r) => ({
    id: r.id,
    account: r.account,
    program: r.program ?? "default",
    amount: r.amount ?? "0",
    claimed: r.claimed ?? "0",
    metadata: r.metadata ?? {},
  }),
  fromRow: (row) => ({
    id: row.id,
    account: row.account,
    program: row.program ?? "default",
    amount: toAmount(row.amount),
    claimed: toAmount(row.claimed),
    metadata: row.metadata ?? {},
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `rewards` table. */
export class RewardsRepository extends BaseRepository<Reward, RewardInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All reward accruals for the given account, newest first. */
  findByAccount(account: string): Promise<Result<readonly Reward[]>> {
    return this.find({
      filters: [{ column: "account", op: "eq", value: account }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All reward accruals under the given program. */
  findByProgram(program: string): Promise<Result<readonly Reward[]>> {
    return this.find({ filters: [{ column: "program", op: "eq", value: program }] });
  }
}

/** Factory: build a `RewardsRepository` over the (possibly null) client. */
export function createRewardsRepository(
  client: SupabaseClient | null,
): RewardsRepository {
  return new RewardsRepository(client);
}

function toAmount(value: unknown): string {
  return value === null || value === undefined ? "0" : String(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
