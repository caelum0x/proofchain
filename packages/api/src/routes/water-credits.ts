/**
 * /water-credits — tradable water credits (Energy/ESG: WaterCreditRegistry).
 * Serves the `water_credits` projection (owner, basin, volume, status) with
 * list / detail / search over the indexed read model.
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

const STATUSES = ['issued', 'transferred', 'retired'] as const;

const SearchQuery = z.object({
  owner: AddressSchema.optional(),
  basin: z.string().trim().min(1).max(64).optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/water-credits', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'water_credits', pagination });
  });

  app.get('/water-credits/search', async (request) => {
    const pagination = paginate(request.query);
    const { owner, basin, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'water credit search query',
    );
    return listTable(ctx.db, {
      table: 'water_credits',
      pagination,
      filters: { owner, basin, status },
    });
  });

  app.get('/water-credits/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'water credit id');
    return getRowOr404(
      ctx.db,
      'water_credits',
      'id',
      recordId,
      'Water credit',
    );
  });
});
