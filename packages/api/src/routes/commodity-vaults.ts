/**
 * /commodity-vaults — tokenized commodity vaults (Commodities: CommodityVault).
 * Serves the `commodity_vaults` projection (owner, commodity, backing quantity,
 * status) with list / detail / search over the indexed read model.
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

const STATUSES = ['open', 'closed', 'liquidated'] as const;

const SearchQuery = z.object({
  owner: AddressSchema.optional(),
  commodity: z.string().trim().min(1).max(64).optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/commodity-vaults', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'commodity_vaults', pagination });
  });

  app.get('/commodity-vaults/search', async (request) => {
    const pagination = paginate(request.query);
    const { owner, commodity, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'commodity vault search query',
    );
    return listTable(ctx.db, {
      table: 'commodity_vaults',
      pagination,
      filters: { owner, commodity, status },
    });
  });

  app.get('/commodity-vaults/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'commodity vault id');
    return getRowOr404(
      ctx.db,
      'commodity_vaults',
      'id',
      recordId,
      'Commodity vault',
    );
  });
});
