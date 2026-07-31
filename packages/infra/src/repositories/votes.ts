/**
 * Votes repository — typed data access for the `votes` governance table (M7).
 * Votes are append-only; `id = '<proposalId>:<voter>'` so a re-index is
 * idempotent. This table has no `updated_at`. See `deals.ts` for the fill
 * convention; never hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Uint256String } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Governor vote support: 0 = against, 1 = for, 2 = abstain. */
export const VoteSupport = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export type VoteSupport = z.infer<typeof VoteSupport>;

/** Fields accepted when creating/upserting a vote. */
export const VoteInput = z.object({
  id: z.string().min(1),
  proposalId: z.string().min(1),
  voter: AddressHex,
  support: VoteSupport,
  weight: Uint256String.optional(),
  reason: z.string().nullable().optional(),
});
export type VoteInput = z.infer<typeof VoteInput>;

/** A vote row as stored/returned. */
export const Vote = z.object({
  id: z.string(),
  proposalId: z.string(),
  voter: AddressHex,
  support: VoteSupport,
  weight: Uint256String,
  reason: z.string().nullable(),
  createdAt: z.string(),
});
export type Vote = z.infer<typeof Vote>;

const config: RepositoryConfig<Vote, VoteInput> = {
  table: "votes",
  primaryKey: "id",
  entitySchema: Vote,
  insertSchema: VoteInput,
  toRow: (v) => ({
    id: v.id,
    proposal_id: v.proposalId,
    voter: v.voter,
    support: v.support,
    weight: v.weight ?? "0",
    reason: v.reason ?? null,
  }),
  fromRow: (row) => ({
    id: row.id,
    proposalId: row.proposal_id,
    voter: row.voter,
    support: toInt(row.support),
    weight: toAmount(row.weight),
    reason: row.reason ?? null,
    createdAt: normalizeTimestamp(row.created_at),
  }),
};

/** Typed data access for the `votes` table. */
export class VotesRepository extends BaseRepository<Vote, VoteInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All votes cast on the given proposal, newest first. */
  findByProposal(proposalId: string): Promise<Result<readonly Vote[]>> {
    return this.find({
      filters: [{ column: "proposal_id", op: "eq", value: proposalId }],
      orderBy: { column: "created_at", ascending: false },
    });
  }

  /** All votes cast by the given voter. */
  findByVoter(voter: string): Promise<Result<readonly Vote[]>> {
    return this.find({ filters: [{ column: "voter", op: "eq", value: voter }] });
  }
}

/** Factory: build a `VotesRepository` over the (possibly null) client. */
export function createVotesRepository(
  client: SupabaseClient | null,
): VotesRepository {
  return new VotesRepository(client);
}

function toInt(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function toAmount(value: unknown): string {
  return value === null || value === undefined ? "0" : String(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
