/**
 * /commodities — tradable commodity definitions (Commodities: CommodityRegistry).
 * Serves the `commodities` projection (symbol, category, unit, decimals) with
 * list / search and symbol-keyed detail over the indexed read model.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import {
  getRowOr404,
  listTable,
  paginate,
  parseOrThrow,
} from '../lib/resourceRoutes.js';

/** A commodity ticker symbol, normalized to uppercase (e.g. `WHEAT`, `CU`). */
const SymbolSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9._-]+$/, 'must be an alphanumeric symbol')
  .transform((s) => s.toUpperCase());

const SearchQuery = z.object({
  symbol: SymbolSchema.optional(),
  category: z.string().trim().min(1).max(64).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/commodities', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'commodities', pagination });
  });

  app.get('/commodities/search', async (request) => {
    const pagination = paginate(request.query);
    const { symbol, category } = parseOrThrow(
      SearchQuery,
      request.query,
      'commodity search query',
    );
    return listTable(ctx.db, {
      table: 'commodities',
      pagination,
      filters: { symbol, category },
    });
  });

  app.get('/commodities/:symbol', async (request) => {
    const { symbol } = request.params as { symbol: string };
    const ticker = parseOrThrow(SymbolSchema, symbol, 'commodity symbol');
    return getRowOr404(ctx.db, 'commodities', 'symbol', ticker, 'Commodity');
  });
});
