/**
 * Proposals repository — typed data access for the `proposals` governance table
 * (M7 on-chain governance). See `deals.ts` for the fill convention; never
 * hand-edit `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex, Uint256String } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Fields accepted when creating/upserting a proposal. */
export const ProposalInput = z.object({
  id: z.string().min(1),
  proposer: AddressHex.nullable().optional(),
  descriptionUri: z.string().nullable().optional(),
  state: z.string().optional(),
  forVotes: Uint256String.optional(),
  againstVotes: Uint256String.optional(),
  abstainVotes: Uint256String.optional(),
  startBlock: Uint256String.nullable().optional(),
  endBlock: Uint256String.nullable().optional(),
});
export type ProposalInput = z.infer<typeof ProposalInput>;

/** A proposal row as stored/returned. */
export const Proposal = z.object({
  id: z.string(),
  proposer: AddressHex.nullable(),
  descriptionUri: z.string().nullable(),
  state: z.string(),
  forVotes: Uint256String,
  againstVotes: Uint256String,
  abstainVotes: Uint256String,
  startBlock: Uint256String.nullable(),
  endBlock: Uint256String.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Proposal = z.infer<typeof Proposal>;

const config: RepositoryConfig<Proposal, ProposalInput> = {
  table: "proposals",
  primaryKey: "id",
  entitySchema: Proposal,
  insertSchema: ProposalInput,
  toRow: (p) => ({
    id: p.id,
    proposer: p.proposer ?? null,
    description_uri: p.descriptionUri ?? null,
    state: p.state ?? "pending",
    for_votes: p.forVotes ?? "0",
    against_votes: p.againstVotes ?? "0",
    abstain_votes: p.abstainVotes ?? "0",
    start_block: p.startBlock ?? null,
    end_block: p.endBlock ?? null,
  }),
  fromRow: (row) => ({
    id: row.id,
    proposer: row.proposer ?? null,
    descriptionUri: row.description_uri ?? null,
    state: row.state,
    forVotes: toAmount(row.for_votes),
    againstVotes: toAmount(row.against_votes),
    abstainVotes: toAmount(row.abstain_votes),
    startBlock: toAmountOrNull(row.start_block),
    endBlock: toAmountOrNull(row.end_block),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }),
};

/** Typed data access for the `proposals` table. */
export class ProposalsRepository extends BaseRepository<Proposal, ProposalInput> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All proposals currently in the given state (e.g. "active"), newest first. */
  findByState(state: string): Promise<Result<readonly Proposal[]>> {
    return this.find({
      filters: [{ column: "state", op: "eq", value: state }],
      orderBy: { column: "updated_at", ascending: false },
    });
  }

  /** All proposals created by the given proposer. */
  findByProposer(proposer: string): Promise<Result<readonly Proposal[]>> {
    return this.find({ filters: [{ column: "proposer", op: "eq", value: proposer }] });
  }
}

/** Factory: build a `ProposalsRepository` over the (possibly null) client. */
export function createProposalsRepository(
  client: SupabaseClient | null,
): ProposalsRepository {
  return new ProposalsRepository(client);
}

function toAmount(value: unknown): string {
  return value === null || value === undefined ? "0" : String(value);
}

function toAmountOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
