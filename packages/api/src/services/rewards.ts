/**
 * Rewards service (M10: LoyaltyPoints, RewardsDistributor, StakingRewards).
 *
 * Aggregates the indexed `rewards` projection (per account/program amount
 * accrued vs claimed) with an on-chain `rewardsOf(account)` fallback, and can
 * summarize an account's outstanding (claimable) balance across programs.
 */
import type { Pagination } from '../lib/pagination.js';
import { jsonSafe, readView, resolveContract } from '../lib/reads.js';
import { defineService, pageRows, type ListResult } from './base.js';
import { compactFilters } from './filters.js';

const TABLE = 'rewards';
const CONTRACT = 'RewardsDistributor';

/** A reward row as stored in the indexed read model. */
export interface RewardRow {
  readonly id: string;
  readonly account: string | null;
  readonly program: string | null;
  readonly accrued: string | null;
  readonly claimed: string | null;
}

export type RewardDetail = RewardRow & { readonly source: 'db' | 'chain' };

/** Aggregate claimable summary for one account across programs. */
export interface RewardSummary {
  readonly account: string;
  readonly accrued: string;
  readonly claimed: string;
  readonly claimable: string;
  readonly programs: number;
}

/** Shape returned by the on-chain `rewardsOf(account)` view. */
interface OnChainReward {
  readonly accrued: bigint;
  readonly claimed: bigint;
  readonly exists: boolean;
}

export interface RewardListQuery {
  readonly pagination: Pagination;
  readonly account?: string;
  readonly program?: string;
}

export interface RewardsService {
  list(query: RewardListQuery): Promise<ListResult<RewardRow>>;
  getById(id: string): Promise<RewardDetail | null>;
  /** Sum an account's accrued/claimed across its indexed programs. */
  summarize(account: string): Promise<RewardSummary>;
}

const toBig = (value: string | null): bigint => {
  if (value === null || !/^\d+$/.test(value)) return 0n;
  return BigInt(value);
};

export const createRewardsService = defineService<RewardsService>((ctx) => {
  const readChainReward = async (
    account: string,
  ): Promise<RewardSummary | null> => {
    const contract = resolveContract(ctx, CONTRACT);
    if (contract === null) return null;
    const reward = (await readView(ctx, contract, 'rewardsOf', [account])) as
      | OnChainReward
      | undefined;
    if (reward === undefined || reward.exists !== true) return null;
    return {
      account: account.toLowerCase(),
      accrued: reward.accrued.toString(),
      claimed: reward.claimed.toString(),
      claimable: (reward.accrued - reward.claimed).toString(),
      programs: 0,
    };
  };

  return {
    async list({
      pagination,
      account,
      program,
    }): Promise<ListResult<RewardRow>> {
      const filters = compactFilters({ account, program });
      return pageRows<RewardRow>(ctx.db, {
        table: TABLE,
        pagination,
        ...(Object.keys(filters).length > 0 ? { filters } : {}),
        order: { column: 'created_at', ascending: false },
      });
    },

    async getById(id): Promise<RewardDetail | null> {
      const row = await ctx.db.getBy<RewardRow>(TABLE, 'id', id);
      if (row !== null) return { ...row, source: 'db' };
      // Detail is keyed by the projection row id; no per-id chain view exists.
      return null;
    },

    async summarize(account): Promise<RewardSummary> {
      const rows = await ctx.db.list<RewardRow>(TABLE, {
        filters: { account },
        order: { column: 'created_at', ascending: false },
      });
      if (rows.length > 0) {
        let accrued = 0n;
        let claimed = 0n;
        for (const row of rows) {
          accrued += toBig(row.accrued);
          claimed += toBig(row.claimed);
        }
        return {
          account,
          accrued: accrued.toString(),
          claimed: claimed.toString(),
          claimable: (accrued - claimed).toString(),
          programs: rows.length,
        };
      }

      const onChain = await readChainReward(account);
      return (
        onChain ?? {
          account,
          accrued: '0',
          claimed: '0',
          claimable: '0',
          programs: 0,
        }
      );
    },
  };
});
