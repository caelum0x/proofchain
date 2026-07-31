/**
 * Bonds service (M4: SupplierBond).
 *
 * Aggregates the indexed `bonds` read model with an on-chain fallback that reads
 * the `bondOf`/`lockedOf`/`unlockedOf`/`bondTokenOf` views. uint256 amounts are
 * returned as decimal strings. A supplier with no bond is a valid answer
 * (`source: 'unknown'`, zeros) rather than a null — mirroring the route's
 * always-answer semantics.
 */
import type { Pagination } from '../lib/pagination.js';
import { readView, resolveContract } from '../lib/reads.js';
import { defineService, pageRows, type ListResult } from './base.js';

const TABLE = 'bonds';
const CONTRACT = 'SupplierBond';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const BOND_STATUSES = ['active', 'withdrawn', 'slashed'] as const;
export type BondStatus = (typeof BOND_STATUSES)[number];

/** A bond row as stored in the indexed read model. */
export interface BondRow {
  readonly supplier: string;
  readonly token: string | null;
  readonly amount: string;
  readonly locked: string;
  readonly status: string;
}

/** Detail DTO: a bond plus its unlocked balance and resolution source. */
export type BondDetail = BondRow & {
  readonly unlocked?: string;
  readonly source: 'db' | 'chain' | 'unknown';
};

export interface BondListQuery {
  readonly pagination: Pagination;
  readonly status?: BondStatus;
}

export interface BondsService {
  list(query: BondListQuery): Promise<ListResult<BondRow>>;
  /** Resolve a supplier's bond (DB-first, on-chain fallback, else zeros). */
  getBySupplier(supplier: string): Promise<BondDetail>;
}

export const createBondsService = defineService<BondsService>((ctx) => {
  const readChainBond = async (
    supplier: string,
  ): Promise<(BondRow & { unlocked: string }) | null> => {
    const contract = resolveContract(ctx, CONTRACT);
    if (contract === null) return null;
    const [amount, locked, unlocked, token] = (await Promise.all([
      readView(ctx, contract, 'bondOf', [supplier]),
      readView(ctx, contract, 'lockedOf', [supplier]),
      readView(ctx, contract, 'unlockedOf', [supplier]),
      readView(ctx, contract, 'bondTokenOf', [supplier]),
    ])) as [bigint, bigint, bigint, string];
    const tokenAddr = String(token).toLowerCase();
    return {
      supplier: supplier.toLowerCase(),
      token: tokenAddr === ZERO_ADDRESS ? null : tokenAddr,
      amount: amount.toString(),
      locked: locked.toString(),
      unlocked: unlocked.toString(),
      status: amount > 0n ? 'active' : 'withdrawn',
    };
  };

  return {
    async list({ pagination, status }): Promise<ListResult<BondRow>> {
      return pageRows<BondRow>(ctx.db, {
        table: TABLE,
        pagination,
        ...(status !== undefined ? { filters: { status } } : {}),
        order: { column: 'updated_at', ascending: false },
      });
    },

    async getBySupplier(supplier): Promise<BondDetail> {
      const row = await ctx.db.getBy<BondRow>(TABLE, 'supplier', supplier);
      if (row !== null) return { ...row, source: 'db' };

      const onChain = await readChainBond(supplier);
      if (onChain === null) {
        return {
          supplier,
          token: null,
          amount: '0',
          locked: '0',
          unlocked: '0',
          status: 'withdrawn',
          source: 'unknown',
        };
      }
      return { ...onChain, source: 'chain' };
    },
  };
});
