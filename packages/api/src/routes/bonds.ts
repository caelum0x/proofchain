/**
 * /bonds — supplier bond stakes (M4 SupplierBond).
 *
 * List (optionally filtered by status) reads the indexed `bonds` read model;
 * detail is DB-first and falls back to the on-chain bond views
 * (`bondOf`/`lockedOf`/`unlockedOf`/`bondTokenOf`). uint256 amounts are returned
 * as decimal strings.
 */
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { ok, okPage } from '../lib/envelope.js';
import { pageMeta, parsePagination } from '../lib/pagination.js';
import {
  hexAddress,
  parseOr400,
  readView,
  resolveContract,
} from '../lib/reads.js';
import { defineRoutes } from '../lib/route.js';

interface BondRow {
  supplier: string;
  token: string | null;
  amount: string;
  locked: string;
  status: string;
}

const TABLE = 'bonds';
const CONTRACT = 'SupplierBond';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const STATUSES = ['active', 'withdrawn', 'slashed'] as const;

const ListQuery = z.object({ status: z.enum(STATUSES).optional() });
const AddressParams = z.object({ supplier: hexAddress });

const readChainBond = async (
  ctx: AppContext,
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

export default defineRoutes((app, ctx) => {
  app.get('/bonds', async (request) => {
    const { status } = parseOr400(ListQuery, request.query);
    const pagination = parsePagination(request.query);
    const filters = status !== undefined ? { status } : undefined;
    const [rows, total] = await Promise.all([
      ctx.db.list<BondRow>(TABLE, {
        ...pagination,
        order: { column: 'updated_at', ascending: false },
        filters,
      }),
      ctx.db.count(TABLE, filters),
    ]);
    return okPage(rows, pageMeta(total, pagination));
  });

  app.get('/bonds/:supplier', async (request) => {
    const { supplier } = parseOr400(AddressParams, request.params);
    const row = await ctx.db.getBy<BondRow>(TABLE, 'supplier', supplier);
    if (row !== null) return ok({ ...row, source: 'db' as const });

    const onChain = await readChainBond(ctx, supplier);
    if (onChain === null) {
      return ok({
        supplier,
        token: null,
        amount: '0',
        locked: '0',
        unlocked: '0',
        status: 'withdrawn' as const,
        source: 'unknown' as const,
      });
    }
    return ok({ ...onChain, source: 'chain' as const });
  });
});
