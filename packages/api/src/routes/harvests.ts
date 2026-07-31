/**
 * /harvests — agricultural harvest lots (Commodities: HarvestRegistry). Serves
 * the `harvests` projection (producer, commodity, season, yield) with list /
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

const SearchQuery = z.object({
  producer: AddressSchema.optional(),
  commodity: z.string().trim().min(1).max(64).optional(),
  season: z.string().trim().min(1).max(32).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/harvests', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'harvests', pagination });
  });

  app.get('/harvests/search', async (request) => {
    const pagination = paginate(request.query);
    const { producer, commodity, season } = parseOrThrow(
      SearchQuery,
      request.query,
      'harvest search query',
    );
    return listTable(ctx.db, {
      table: 'harvests',
      pagination,
      filters: { producer, commodity, season },
    });
  });

  app.get('/harvests/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'harvest id');
    return getRowOr404(ctx.db, 'harvests', 'id', recordId, 'Harvest');
  });
});
