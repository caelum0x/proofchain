/**
 * /deals — settlement deals (M2 SettlementEscrow).
 *
 * List/search read the indexed `deals` read model (projected from escrow
 * lifecycle events) with optional buyer/supplier/state filters. Detail is
 * DB-first and falls back to an on-chain `getDeal` read, additionally surfacing
 * any `payeeOverride` (invoice-financing assignment).
 */
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { ok, okPage } from '../lib/envelope.js';
import { notFound } from '../lib/errors.js';
import { pageMeta, parsePagination } from '../lib/pagination.js';
import {
  hexAddress,
  hexBatchId,
  parseOr400,
  readView,
  resolveContract,
} from '../lib/reads.js';
import { defineRoutes } from '../lib/route.js';

interface DealRow {
  batch_id: string;
  buyer: string;
  supplier: string;
  token: string;
  amount: string;
  state: string;
  tx_hash: string | null;
}

interface OnChainDeal {
  batchId: string;
  buyer: string;
  supplier: string;
  token: string;
  amount: bigint;
  state: number;
}

const TABLE = 'deals';
const CONTRACT = 'SettlementEscrow';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// SettlementEscrow.DealState enum → read-model status.
const STATE_NAMES = ['none', 'funded', 'released', 'refunded', 'disputed'] as const;
const STATES = ['funded', 'released', 'refunded', 'disputed'] as const;

const FilterQuery = z.object({
  buyer: hexAddress.optional(),
  supplier: hexAddress.optional(),
  state: z.enum(STATES).optional(),
});
const BatchParams = z.object({ batchId: hexBatchId });

const buildFilters = (q: z.infer<typeof FilterQuery>): Record<string, string> => {
  const filters: Record<string, string> = {};
  if (q.buyer !== undefined) filters.buyer = q.buyer;
  if (q.supplier !== undefined) filters.supplier = q.supplier;
  if (q.state !== undefined) filters.state = q.state;
  return filters;
};

const readChainDeal = async (
  ctx: AppContext,
  batchId: string,
): Promise<(DealRow & { payee: string | null }) | null> => {
  const contract = resolveContract(ctx, CONTRACT);
  if (contract === null) return null;
  const deal = (await readView(ctx, contract, 'getDeal', [batchId])) as
    | OnChainDeal
    | undefined;
  if (deal === undefined || Number(deal.state) === 0) return null; // None → not funded
  const payee = (await readView(ctx, contract, 'payeeOverride', [batchId])) as string;
  const payeeAddr = String(payee).toLowerCase();
  return {
    batch_id: batchId.toLowerCase(),
    buyer: deal.buyer.toLowerCase(),
    supplier: deal.supplier.toLowerCase(),
    token: deal.token.toLowerCase(),
    amount: deal.amount.toString(),
    state: STATE_NAMES[Number(deal.state)] ?? 'none',
    tx_hash: null,
    payee: payeeAddr === ZERO_ADDRESS ? null : payeeAddr,
  };
};

export default defineRoutes((app, ctx) => {
  const listHandler = async (query: unknown) => {
    const parsed = parseOr400(FilterQuery, query);
    const pagination = parsePagination(query);
    const filters = buildFilters(parsed);
    const listFilters = Object.keys(filters).length > 0 ? filters : undefined;
    const [rows, total] = await Promise.all([
      ctx.db.list<DealRow>(TABLE, {
        ...pagination,
        order: { column: 'updated_at', ascending: false },
        filters: listFilters,
      }),
      ctx.db.count(TABLE, listFilters),
    ]);
    return okPage(rows, pageMeta(total, pagination));
  };

  app.get('/deals', async (request) => listHandler(request.query));
  app.get('/deals/search', async (request) => listHandler(request.query));

  app.get('/deals/:batchId', async (request) => {
    const { batchId } = parseOr400(BatchParams, request.params);
    const row = await ctx.db.getBy<DealRow>(TABLE, 'batch_id', batchId);
    if (row !== null) return ok({ ...row, source: 'db' as const });

    const onChain = await readChainDeal(ctx, batchId);
    if (onChain === null) {
      throw notFound(`Deal for batch ${batchId} not found`);
    }
    return ok({ ...onChain, source: 'chain' as const });
  });
});
