/**
 * /search — global cross-resource lookup.
 *
 * Classifies the query and dispatches to the right read model:
 *   - a 32-byte hex id → batch-scoped resources (deals, verdicts, receivables);
 *   - a 20-byte hex address → identity/reputation/bond/kyc registries;
 *   - anything else → a name search across identity read models.
 * Returns a categorized result set so a single box drives the whole explorer.
 */
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { ok } from '../lib/envelope.js';
import { DEFAULT_PAGE_LIMIT } from '../config/constants.js';
import { isHexAddress, isHexBatchId, parseOr400 } from '../lib/reads.js';
import { defineRoutes } from '../lib/route.js';

const SearchQuery = z.object({ q: z.string().trim().min(1).max(256) });

type Row = Record<string, unknown>;

const searchByBatch = async (
  ctx: AppContext,
  batchId: string,
): Promise<Record<string, Row | null>> => {
  const [deal, verdict, receivable] = await Promise.all([
    ctx.db.getBy<Row>('deals', 'batch_id', batchId),
    ctx.db.getBy<Row>('verdicts', 'batch_id', batchId),
    ctx.db.getBy<Row>('receivables', 'batch_id', batchId),
  ]);
  return { deal, verdict, receivable };
};

const searchByAddress = async (
  ctx: AppContext,
  address: string,
): Promise<Record<string, Row | null>> => {
  const [supplier, buyer, carrier, reputation, bond, kyc] = await Promise.all([
    ctx.db.getBy<Row>('suppliers', 'address', address),
    ctx.db.getBy<Row>('buyers', 'address', address),
    ctx.db.getBy<Row>('carriers', 'address', address),
    ctx.db.getBy<Row>('reputation', 'supplier', address),
    ctx.db.getBy<Row>('bonds', 'supplier', address),
    ctx.db.getBy<Row>('kyc', 'address', address),
  ]);
  return { supplier, buyer, carrier, reputation, bond, kyc };
};

const nameMatches = (rows: Row[], needle: string): Row[] =>
  rows.filter((r) => String(r.name ?? '').toLowerCase().includes(needle));

const searchByText = async (
  ctx: AppContext,
  text: string,
): Promise<Record<string, Row[]>> => {
  const needle = text.toLowerCase();
  const opts = { limit: DEFAULT_PAGE_LIMIT, offset: 0 } as const;
  const [orgs, suppliers, buyers, carriers] = await Promise.all([
    ctx.db.list<Row>('organizations', opts),
    ctx.db.list<Row>('suppliers', opts),
    ctx.db.list<Row>('buyers', opts),
    ctx.db.list<Row>('carriers', opts),
  ]);
  return {
    organizations: nameMatches(orgs, needle),
    suppliers: nameMatches(suppliers, needle),
    buyers: nameMatches(buyers, needle),
    carriers: nameMatches(carriers, needle),
  };
};

export default defineRoutes((app, ctx) => {
  app.get('/search', async (request) => {
    const { q } = parseOr400(SearchQuery, request.query);

    if (isHexBatchId(q)) {
      const results = await searchByBatch(ctx, q.toLowerCase());
      return ok({ query: q, kind: 'batchId' as const, results });
    }
    if (isHexAddress(q)) {
      const results = await searchByAddress(ctx, q.toLowerCase());
      return ok({ query: q, kind: 'address' as const, results });
    }
    const results = await searchByText(ctx, q);
    return ok({ query: q, kind: 'text' as const, results });
  });
});
