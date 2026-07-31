/**
 * Claims service (M6: ClaimsProcessor).
 *
 * Aggregates the indexed `claims` projection with an on-chain `claimOf(id)`
 * fallback and returns typed DTOs with a `source` discriminator. Serves the
 * `filed → approved | paid | rejected` lifecycle.
 */
import type { Pagination } from '../lib/pagination.js';
import { jsonSafe, readView, resolveContract } from '../lib/reads.js';
import { defineService, pageRows, type ListResult } from './base.js';
import { compactFilters } from './filters.js';

const TABLE = 'claims';
const CONTRACT = 'ClaimsProcessor';

export const CLAIM_STATUSES = [
  'filed',
  'approved',
  'paid',
  'rejected',
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

/** A claim row as stored in the indexed read model. */
export interface ClaimRow {
  readonly id: string;
  readonly policy_id: string | null;
  readonly batch_id: string | null;
  readonly claimant: string | null;
  readonly amount: string | null;
  readonly status: string | null;
}

export type ClaimDetail = ClaimRow & { readonly source: 'db' | 'chain' };

/** Shape returned by the on-chain `claimOf(id)` view. */
interface OnChainClaim {
  readonly policyId: string;
  readonly claimant: string;
  readonly amount: bigint;
  readonly status: number;
  readonly exists: boolean;
}

export interface ClaimListQuery {
  readonly pagination: Pagination;
  readonly policyId?: string;
  readonly batchId?: string;
  readonly claimant?: string;
  readonly status?: ClaimStatus;
}

export interface ClaimsService {
  list(query: ClaimListQuery): Promise<ListResult<ClaimRow>>;
  getById(id: string): Promise<ClaimDetail | null>;
}

export const createClaimsService = defineService<ClaimsService>((ctx) => {
  const readChainClaim = async (id: string): Promise<ClaimRow | null> => {
    const contract = resolveContract(ctx, CONTRACT);
    if (contract === null) return null;
    const claim = (await readView(ctx, contract, 'claimOf', [id])) as
      | OnChainClaim
      | undefined;
    if (claim === undefined || claim.exists !== true) return null;
    return jsonSafe({
      id,
      policy_id: claim.policyId,
      batch_id: null,
      claimant: claim.claimant.toLowerCase(),
      amount: claim.amount,
      status: CLAIM_STATUSES[claim.status] ?? String(claim.status),
    }) as ClaimRow;
  };

  return {
    async list({
      pagination,
      policyId,
      batchId,
      claimant,
      status,
    }): Promise<ListResult<ClaimRow>> {
      const filters = compactFilters({
        policy_id: policyId,
        batch_id: batchId,
        claimant,
        status,
      });
      return pageRows<ClaimRow>(ctx.db, {
        table: TABLE,
        pagination,
        ...(Object.keys(filters).length > 0 ? { filters } : {}),
        order: { column: 'created_at', ascending: false },
      });
    },

    async getById(id): Promise<ClaimDetail | null> {
      const row = await ctx.db.getBy<ClaimRow>(TABLE, 'id', id);
      if (row !== null) return { ...row, source: 'db' };

      const onChain = await readChainClaim(id);
      if (onChain === null) return null;
      return { ...onChain, source: 'chain' };
    },
  };
});
