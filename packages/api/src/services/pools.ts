/**
 * Pools service (M5: FinancingPool + LenderVault).
 *
 * A FinancingPool auto-funds eligible receivables by risk grade; LenderVault
 * tokenizes pool shares (ERC4626-style). Aggregates the indexed `pools`
 * projection (manager, total assets/shares, risk grade) with an on-chain
 * `poolOf(id)` fallback.
 */
import type { Pagination } from '../lib/pagination.js';
import { jsonSafe, readView, resolveContract } from '../lib/reads.js';
import { defineService, pageRows, type ListResult } from './base.js';
import { compactFilters } from './filters.js';

const TABLE = 'pools';
const CONTRACT = 'FinancingPool';

/** A pool row as stored in the indexed read model. */
export interface PoolRow {
  readonly id: string;
  readonly manager: string | null;
  readonly total_assets: string | null;
  readonly total_shares: string | null;
  readonly risk_grade: number | null;
}

export type PoolDetail = PoolRow & { readonly source: 'db' | 'chain' };

/** Shape returned by the on-chain `poolOf(id)` view. */
interface OnChainPool {
  readonly manager: string;
  readonly totalAssets: bigint;
  readonly totalShares: bigint;
  readonly riskGrade: number | bigint;
  readonly exists: boolean;
}

export interface PoolListQuery {
  readonly pagination: Pagination;
  readonly manager?: string;
  readonly grade?: number;
}

export interface PoolsService {
  list(query: PoolListQuery): Promise<ListResult<PoolRow>>;
  getById(id: string): Promise<PoolDetail | null>;
}

export const createPoolsService = defineService<PoolsService>((ctx) => {
  const readChainPool = async (id: string): Promise<PoolRow | null> => {
    const contract = resolveContract(ctx, CONTRACT);
    if (contract === null) return null;
    const pool = (await readView(ctx, contract, 'poolOf', [id])) as
      | OnChainPool
      | undefined;
    if (pool === undefined || pool.exists !== true) return null;
    return jsonSafe({
      id,
      manager: pool.manager.toLowerCase(),
      total_assets: pool.totalAssets,
      total_shares: pool.totalShares,
      risk_grade: Number(pool.riskGrade),
    }) as PoolRow;
  };

  return {
    async list({ pagination, manager, grade }): Promise<ListResult<PoolRow>> {
      const filters = compactFilters({ manager, risk_grade: grade });
      return pageRows<PoolRow>(ctx.db, {
        table: TABLE,
        pagination,
        ...(Object.keys(filters).length > 0 ? { filters } : {}),
        order: { column: 'created_at', ascending: false },
      });
    },

    async getById(id): Promise<PoolDetail | null> {
      const row = await ctx.db.getBy<PoolRow>(TABLE, 'id', id);
      if (row !== null) return { ...row, source: 'db' };

      const onChain = await readChainPool(id);
      if (onChain === null) return null;
      return { ...onChain, source: 'chain' };
    },
  };
});
