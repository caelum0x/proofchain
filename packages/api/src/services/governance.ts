/**
 * Governance service (M7: ProofChainGovernor, ProposalRegistry, GovernanceToken).
 *
 * Aggregates the indexed `proposals` projection and the append-only `votes`
 * table with an on-chain `proposalOf(id)` fallback (state resolved via the
 * governor). Returns typed DTOs; the `/governance` route wraps them.
 */
import type { Pagination } from '../lib/pagination.js';
import { jsonSafe, readView, resolveContract } from '../lib/reads.js';
import { defineService, pageRows, type ListResult } from './base.js';
import { compactFilters } from './filters.js';

const PROPOSALS_TABLE = 'proposals';
const VOTES_TABLE = 'votes';
const CONTRACT = 'ProposalRegistry';

/** A proposal row as stored in the indexed read model. */
export interface ProposalRow {
  readonly id: string;
  readonly proposer: string | null;
  readonly description: string | null;
  readonly state: string | null;
  readonly for_votes: string | null;
  readonly against_votes: string | null;
}

export type ProposalDetail = ProposalRow & { readonly source: 'db' | 'chain' };

/** A vote row as stored in the append-only `votes` table. */
export interface VoteRow {
  readonly proposal_id: string;
  readonly voter: string;
  readonly support: number | null;
  readonly weight: string | null;
}

/** Shape returned by the on-chain `proposalOf(id)` view. */
interface OnChainProposal {
  readonly proposer: string;
  readonly description: string;
  readonly state: number;
  readonly forVotes: bigint;
  readonly againstVotes: bigint;
  readonly exists: boolean;
}

export const PROPOSAL_STATES = [
  'pending',
  'active',
  'canceled',
  'defeated',
  'succeeded',
  'queued',
  'expired',
  'executed',
] as const;

export interface ProposalListQuery {
  readonly pagination: Pagination;
  readonly state?: string;
  readonly proposer?: string;
}

export interface VoteListQuery {
  readonly pagination: Pagination;
  readonly proposalId?: string;
  readonly voter?: string;
}

export interface GovernanceService {
  listProposals(query: ProposalListQuery): Promise<ListResult<ProposalRow>>;
  getProposal(id: string): Promise<ProposalDetail | null>;
  listVotes(query: VoteListQuery): Promise<ListResult<VoteRow>>;
}

export const createGovernanceService = defineService<GovernanceService>(
  (ctx) => {
    const readChainProposal = async (
      id: string,
    ): Promise<ProposalRow | null> => {
      const contract = resolveContract(ctx, CONTRACT);
      if (contract === null) return null;
      const proposal = (await readView(ctx, contract, 'proposalOf', [id])) as
        | OnChainProposal
        | undefined;
      if (proposal === undefined || proposal.exists !== true) return null;
      return jsonSafe({
        id,
        proposer: proposal.proposer.toLowerCase(),
        description: proposal.description,
        state: PROPOSAL_STATES[proposal.state] ?? String(proposal.state),
        for_votes: proposal.forVotes,
        against_votes: proposal.againstVotes,
      }) as ProposalRow;
    };

    return {
      async listProposals({
        pagination,
        state,
        proposer,
      }): Promise<ListResult<ProposalRow>> {
        const filters = compactFilters({ state, proposer });
        return pageRows<ProposalRow>(ctx.db, {
          table: PROPOSALS_TABLE,
          pagination,
          ...(Object.keys(filters).length > 0 ? { filters } : {}),
          order: { column: 'created_at', ascending: false },
        });
      },

      async getProposal(id): Promise<ProposalDetail | null> {
        const row = await ctx.db.getBy<ProposalRow>(PROPOSALS_TABLE, 'id', id);
        if (row !== null) return { ...row, source: 'db' };

        const onChain = await readChainProposal(id);
        if (onChain === null) return null;
        return { ...onChain, source: 'chain' };
      },

      async listVotes({
        pagination,
        proposalId,
        voter,
      }): Promise<ListResult<VoteRow>> {
        const filters = compactFilters({ proposal_id: proposalId, voter });
        return pageRows<VoteRow>(ctx.db, {
          table: VOTES_TABLE,
          pagination,
          ...(Object.keys(filters).length > 0 ? { filters } : {}),
          order: { column: 'created_at', ascending: false },
        });
      },
    };
  },
);
