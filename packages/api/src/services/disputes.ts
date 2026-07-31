/**
 * Disputes service (M7: DisputeArbitration).
 *
 * Arbiters vote on Disputed deals; a majority either refunds the buyer or
 * releases to the supplier. Aggregates the indexed `disputes` projection
 * (`open → resolved`, with vote tallies) with an on-chain `disputeOf(batchId)`
 * fallback, and exposes the underlying vote events from the audit log.
 */
import type { Pagination } from '../lib/pagination.js';
import { jsonSafe, readView, resolveContract } from '../lib/reads.js';
import { defineService, pageRows, type ListResult } from './base.js';
import { compactFilters } from './filters.js';

const TABLE = 'disputes';
const EVENTS_TABLE = 'indexer_events';
const CONTRACT = 'DisputeArbitration';
const GROUP = 'governance';

export const DISPUTE_STATUSES = ['open', 'resolved'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

/** A dispute row as stored in the indexed read model. */
export interface DisputeRow {
  readonly batch_id: string;
  readonly opener: string | null;
  readonly for_votes: number | null;
  readonly against_votes: number | null;
  readonly status: string | null;
}

export type DisputeDetail = DisputeRow & { readonly source: 'db' | 'chain' };

/** A projected vote event row from the audit log. */
export type VoteEventRow = Record<string, unknown>;

/** Shape returned by the on-chain `disputeOf(batchId)` view. */
interface OnChainDispute {
  readonly opener: string;
  readonly forVotes: number | bigint;
  readonly againstVotes: number | bigint;
  readonly resolved: boolean;
  readonly exists: boolean;
}

export interface DisputeListQuery {
  readonly pagination: Pagination;
  readonly opener?: string;
  readonly status?: DisputeStatus;
}

export interface DisputesService {
  list(query: DisputeListQuery): Promise<ListResult<DisputeRow>>;
  getByBatchId(batchId: string): Promise<DisputeDetail | null>;
  listVotes(
    batchId: string,
    pagination: Pagination,
  ): Promise<ListResult<VoteEventRow>>;
}

export const createDisputesService = defineService<DisputesService>((ctx) => {
  const readChainDispute = async (
    batchId: string,
  ): Promise<DisputeRow | null> => {
    const contract = resolveContract(ctx, CONTRACT);
    if (contract === null) return null;
    const dispute = (await readView(ctx, contract, 'disputeOf', [batchId])) as
      | OnChainDispute
      | undefined;
    if (dispute === undefined || dispute.exists !== true) return null;
    return jsonSafe({
      batch_id: batchId.toLowerCase(),
      opener: dispute.opener.toLowerCase(),
      for_votes: Number(dispute.forVotes),
      against_votes: Number(dispute.againstVotes),
      status: dispute.resolved ? 'resolved' : 'open',
    }) as DisputeRow;
  };

  return {
    async list({
      pagination,
      opener,
      status,
    }): Promise<ListResult<DisputeRow>> {
      const filters = compactFilters({ opener, status });
      return pageRows<DisputeRow>(ctx.db, {
        table: TABLE,
        pagination,
        ...(Object.keys(filters).length > 0 ? { filters } : {}),
        order: { column: 'created_at', ascending: false },
      });
    },

    async getByBatchId(batchId): Promise<DisputeDetail | null> {
      const row = await ctx.db.getBy<DisputeRow>(TABLE, 'batch_id', batchId);
      if (row !== null) return { ...row, source: 'db' };

      const onChain = await readChainDispute(batchId);
      if (onChain === null) return null;
      return { ...onChain, source: 'chain' };
    },

    async listVotes(batchId, pagination): Promise<ListResult<VoteEventRow>> {
      return pageRows<VoteEventRow>(ctx.db, {
        table: EVENTS_TABLE,
        pagination,
        filters: {
          group_name: GROUP,
          contract: CONTRACT,
          event_name: 'Voted',
          'args->>batchId': batchId,
        },
        order: { column: 'created_at', ascending: false },
      });
    },
  };
});
