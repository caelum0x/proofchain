/**
 * /price-oracle — commodity price feeds (Commodities: PriceOracle). Serves the
 * `price_feeds` projection (symbol, source, price, updated round) with list /
 * search and symbol-keyed latest-price detail over the indexed read model.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import {
  getRowOr404,
  listTable,
  paginate,
  parseOrThrow,
} from '../lib/resourceRoutes.js';

/** A price-feed ticker symbol, normalized to uppercase (e.g. `WHEAT/USD`). */
const SymbolSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9._/-]+$/, 'must be an alphanumeric feed symbol')
  .transform((s) => s.toUpperCase());

const SearchQuery = z.object({
  symbol: SymbolSchema.optional(),
  source: z.string().trim().min(1).max(64).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/price-oracle', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'price_feeds', pagination });
  });

  app.get('/price-oracle/search', async (request) => {
    const pagination = paginate(request.query);
    const { symbol, source } = parseOrThrow(
      SearchQuery,
      request.query,
      'price feed search query',
    );
    return listTable(ctx.db, {
      table: 'price_feeds',
      pagination,
      filters: { symbol, source },
    });
  });

  app.get('/price-oracle/:symbol', async (request) => {
    const { symbol } = request.params as { symbol: string };
    const ticker = parseOrThrow(SymbolSchema, symbol, 'price feed symbol');
    return getRowOr404(ctx.db, 'price_feeds', 'symbol', ticker, 'Price feed');
  });
});
