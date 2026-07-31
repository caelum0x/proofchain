/**
 * /biodiversity — biodiversity credits (Energy/ESG: BiodiversityRegistry).
 * Serves the `biodiversity_credits` projection (owner, project, hectares,
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

const STATUSES = ['issued', 'transferred', 'retired'] as const;

const SearchQuery = z.object({
  owner: AddressSchema.optional(),
  project_id: z.string().trim().min(1).max(128).optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/biodiversity', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'biodiversity_credits', pagination });
  });

  app.get('/biodiversity/search', async (request) => {
    const pagination = paginate(request.query);
    const { owner, project_id, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'biodiversity credit search query',
    );
    return listTable(ctx.db, {
      table: 'biodiversity_credits',
      pagination,
      filters: { owner, project_id, status },
    });
  });

  app.get('/biodiversity/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'biodiversity credit id');
    return getRowOr404(
      ctx.db,
      'biodiversity_credits',
      'id',
      recordId,
      'Biodiversity credit',
    );
  });
});
