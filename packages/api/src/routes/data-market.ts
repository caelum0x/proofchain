/**
 * /data-market — data-marketplace listings (Data: DataMarketplace). Serves the
 * `data_listings` projection (seller, category, price, status) with list /
 * detail / search over the indexed read model.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import {
  AddressSchema,
  IdSchema,
  getRowOr404,
  listTable,
  paginate,
  parseOrThrow,
} from '../lib/resourceRoutes.js';

const STATUSES = ['listed', 'sold', 'delisted'] as const;

const SearchQuery = z.object({
  seller: AddressSchema.optional(),
  category: z.string().trim().min(1).max(64).optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/data-market', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'data_listings', pagination });
  });

  app.get('/data-market/search', async (request) => {
    const pagination = paginate(request.query);
    const { seller, category, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'data listing search query',
    );
    return listTable(ctx.db, {
      table: 'data_listings',
      pagination,
      filters: { seller, category, status },
    });
  });

  app.get('/data-market/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'data listing id');
    return getRowOr404(ctx.db, 'data_listings', 'id', recordId, 'Data listing');
  });
});
