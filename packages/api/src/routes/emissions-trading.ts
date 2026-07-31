/**
 * /emissions-trading — emissions-allowance trades (Energy: EmissionsMarket).
 * Serves the `emissions_trades` projection (buyer, seller, allowance, price,
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

const STATUSES = ['open', 'filled', 'cancelled'] as const;

const SearchQuery = z.object({
  buyer: AddressSchema.optional(),
  seller: AddressSchema.optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/emissions-trading', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'emissions_trades', pagination });
  });

  app.get('/emissions-trading/search', async (request) => {
    const pagination = paginate(request.query);
    const { buyer, seller, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'emissions trade search query',
    );
    return listTable(ctx.db, {
      table: 'emissions_trades',
      pagination,
      filters: { buyer, seller, status },
    });
  });

  app.get('/emissions-trading/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'emissions trade id');
    return getRowOr404(
      ctx.db,
      'emissions_trades',
      'id',
      recordId,
      'Emissions trade',
    );
  });
});
