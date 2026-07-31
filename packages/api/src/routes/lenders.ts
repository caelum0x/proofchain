/**
 * /lenders — lender positions across financing listings and pools (M5).
 *
 * Lenders have no dedicated projection table; a lender is a participant that
 * funds `financing_listings` and deposits into `pools` (via LenderVault). This
 * router derives a lender view by joining those read models in the API layer:
 *   - GET /lenders                 → distinct lenders with aggregate exposure
 *   - GET /lenders/:address        → one lender's funded listings + summary
 *   - GET /lenders/:address/events → that lender's raw LenderVault activity
 */
import { defineRoutes } from '../lib/route.js';
import { ok } from '../lib/envelope.js';
import {
  AddressSchema,
  listEvents,
  listTable,
  paginate,
  parseOrThrow,
} from '../lib/resourceRoutes.js';

interface FinancingRow {
  batch_id: string;
  lender: string | null;
  advance_amount: string | null;
  ask_amount: string;
  status: string;
}

/** Sum decimal-string amounts safely with BigInt (values are wei-scale). */
const sumBig = (values: readonly (string | null)[]): string => {
  let total = 0n;
  for (const v of values) {
    if (v === null) continue;
    if (/^\d+$/.test(v)) total += BigInt(v);
  }
  return total.toString();
};

export default defineRoutes((app, ctx) => {
  // Distinct lenders with aggregate exposure, derived from funded listings.
  app.get('/lenders', async (request) => {
    const pagination = paginate(request.query);
    const rows = await ctx.db.list<FinancingRow>('financing_listings', {
      filters: { status: 'funded' },
      order: { column: 'created_at', ascending: false },
      limit: pagination.limit,
      offset: pagination.offset,
    });
    const byLender = new Map<string, FinancingRow[]>();
    for (const row of rows) {
      const lender = row.lender?.toLowerCase();
      if (lender === undefined) continue;
      const bucket = byLender.get(lender) ?? [];
      bucket.push(row);
      byLender.set(lender, bucket);
    }
    const lenders = [...byLender.entries()].map(([address, listings]) => ({
      address,
      fundedCount: listings.length,
      totalAdvanced: sumBig(listings.map((l) => l.advance_amount)),
      batchIds: listings.map((l) => l.batch_id),
    }));
    return ok(lenders);
  });

  // One lender's funded listings + a computed summary.
  app.get('/lenders/:address', async (request) => {
    const { address } = request.params as { address: string };
    const lender = parseOrThrow(AddressSchema, address, 'lender address');
    const listings = await ctx.db.list<FinancingRow>('financing_listings', {
      filters: { lender },
      order: { column: 'created_at', ascending: false },
    });
    return ok({
      address: lender,
      totalListings: listings.length,
      totalAdvanced: sumBig(listings.map((l) => l.advance_amount)),
      listings,
    });
  });

  // Raw LenderVault deposit/withdraw activity for the lender (from the audit log).
  app.get('/lenders/:address/events', async (request) => {
    const { address } = request.params as { address: string };
    const lender = parseOrThrow(AddressSchema, address, 'lender address');
    const pagination = paginate(request.query);
    return listEvents(ctx.db, {
      group: 'finance',
      contract: 'LenderVault',
      filters: { 'args->>owner': lender },
      pagination,
    });
  });
});
