/**
 * Insurance service (M6: PolicyManager, InsurancePool, ClaimsProcessor).
 *
 * Aggregates the indexed `policies` projection (Supabase via `ctx.db`) with an
 * on-chain `policyOf(id)` fallback (via `ctx.chain` + `@proofchain/shared`) and
 * returns typed DTOs with a `source` discriminator. The `/insurance` route is a
 * thin adapter over this service (see `base.ts` for the convention).
 */
import type { Pagination } from '../lib/pagination.js';
import { jsonSafe, readView, resolveContract } from '../lib/reads.js';
import { defineService, pageRows, type ListResult } from './base.js';
import { compactFilters } from './filters.js';

const TABLE = 'policies';
const CONTRACT = 'PolicyManager';

/** The policy lifecycle projected by the insurance indexer handler. */
export const POLICY_STATUSES = [
  'active',
  'expired',
  'claimed',
  'cancelled',
] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

/** A policy row as stored in the indexed read model. */
export interface PolicyRow {
  readonly id: string;
  readonly holder: string | null;
  readonly batch_id: string | null;
  readonly premium: string | null;
  readonly payout: string | null;
  readonly status: string | null;
}

/** Detail DTO: a policy row plus where it was resolved from. */
export type PolicyDetail = PolicyRow & { readonly source: 'db' | 'chain' };

/** Shape returned by the on-chain `policyOf(id)` view. */
interface OnChainPolicy {
  readonly holder: string;
  readonly batchId: string;
  readonly premium: bigint;
  readonly payout: bigint;
  readonly status: number;
  readonly exists: boolean;
}

export interface PolicyListQuery {
  readonly pagination: Pagination;
  readonly holder?: string;
  readonly batchId?: string;
  readonly status?: PolicyStatus;
}

export interface InsuranceService {
  /** Page the indexed policies, optionally filtered by holder/batch/status. */
  list(query: PolicyListQuery): Promise<ListResult<PolicyRow>>;
  /** Resolve one policy (DB-first, on-chain fallback), or null if unknown. */
  getById(id: string): Promise<PolicyDetail | null>;
}

/** Build an {@link InsuranceService} bound to the request context. */
export const createInsuranceService = defineService<InsuranceService>((ctx) => {
  const readChainPolicy = async (id: string): Promise<PolicyRow | null> => {
    const contract = resolveContract(ctx, CONTRACT);
    if (contract === null) return null;
    const policy = (await readView(ctx, contract, 'policyOf', [id])) as
      | OnChainPolicy
      | undefined;
    if (policy === undefined || policy.exists !== true) return null;
    return jsonSafe({
      id,
      holder: policy.holder.toLowerCase(),
      batch_id: policy.batchId.toLowerCase(),
      premium: policy.premium,
      payout: policy.payout,
      status: POLICY_STATUSES[policy.status] ?? String(policy.status),
    }) as PolicyRow;
  };

  return {
    async list({
      pagination,
      holder,
      batchId,
      status,
    }): Promise<ListResult<PolicyRow>> {
      const filters = compactFilters({ holder, batch_id: batchId, status });
      return pageRows<PolicyRow>(ctx.db, {
        table: TABLE,
        pagination,
        ...(Object.keys(filters).length > 0 ? { filters } : {}),
        order: { column: 'created_at', ascending: false },
      });
    },

    async getById(id): Promise<PolicyDetail | null> {
      const row = await ctx.db.getBy<PolicyRow>(TABLE, 'id', id);
      if (row !== null) return { ...row, source: 'db' };

      const onChain = await readChainPolicy(id);
      if (onChain === null) return null;
      return { ...onChain, source: 'chain' };
    },
  };
});
