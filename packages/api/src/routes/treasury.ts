/**
 * /treasury — protocol fee treasury (M2: Treasury).
 *
 * The Treasury holds protocol fees and supports admin withdrawals. No projection
 * table exists, so this router reads the `indexer_events` audit log (settlement
 * group, Treasury contract) and computes a running balance from Deposit/Withdraw
 * events in the API layer.
 *   - GET /treasury          → summary: totals in/out and net balance
 *   - GET /treasury/flows    → paged Deposit/Withdraw event feed
 *   - GET /treasury/deposits → deposits only
 *   - GET /treasury/withdrawals → withdrawals only
 */
import { defineRoutes } from '../lib/route.js';
import { ok } from '../lib/envelope.js';
import { listEvents, paginate } from '../lib/resourceRoutes.js';
import { MAX_PAGE_LIMIT } from '../config/constants.js';

interface EventRow {
  event_name: string;
  args: Record<string, unknown>;
}

const amountOf = (args: Record<string, unknown>): bigint => {
  const raw = args.amount;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return BigInt(raw);
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0) {
    return BigInt(raw);
  }
  return 0n;
};

export default defineRoutes((app, ctx) => {
  // Aggregate a running balance from the (bounded) most-recent flow window.
  app.get('/treasury', async () => {
    const rows = await ctx.db.list<EventRow>('indexer_events', {
      filters: { group_name: 'settlement', contract: 'Treasury' },
      order: { column: 'created_at', ascending: false },
      limit: MAX_PAGE_LIMIT,
    });
    let deposited = 0n;
    let withdrawn = 0n;
    for (const row of rows) {
      if (row.event_name === 'Deposit') deposited += amountOf(row.args);
      else if (row.event_name === 'Withdraw') withdrawn += amountOf(row.args);
    }
    return ok({
      deposited: deposited.toString(),
      withdrawn: withdrawn.toString(),
      netBalance: (deposited - withdrawn).toString(),
      sampledEvents: rows.length,
      window: MAX_PAGE_LIMIT,
    });
  });

  app.get('/treasury/flows', async (request) => {
    const pagination = paginate(request.query);
    return listEvents(ctx.db, {
      group: 'settlement',
      contract: 'Treasury',
      pagination,
    });
  });

  app.get('/treasury/deposits', async (request) => {
    const pagination = paginate(request.query);
    return listEvents(ctx.db, {
      group: 'settlement',
      contract: 'Treasury',
      eventName: 'Deposit',
      pagination,
    });
  });

  app.get('/treasury/withdrawals', async (request) => {
    const pagination = paginate(request.query);
    return listEvents(ctx.db, {
      group: 'settlement',
      contract: 'Treasury',
      eventName: 'Withdraw',
      pagination,
    });
  });
});
