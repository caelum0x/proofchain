/**
 * /recs — Renewable Energy Certificates (Energy: RECRegistry). Serves the
 * `recs` projection (owner, source type, vintage, MWh, status) with list /
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

const STATUSES = ['issued', 'transferred', 'retired'] as const;

const SearchQuery = z.object({
  owner: AddressSchema.optional(),
  source_type: z.string().trim().min(1).max(32).optional(),
  vintage: z.string().trim().min(1).max(16).optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/recs', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'recs', pagination });
  });

  app.get('/recs/search', async (request) => {
    const pagination = paginate(request.query);
    const { owner, source_type, vintage, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'REC search query',
    );
    return listTable(ctx.db, {
      table: 'recs',
      pagination,
      filters: { owner, source_type, vintage, status },
    });
  });

  app.get('/recs/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'REC id');
    return getRowOr404(ctx.db, 'recs', 'id', recordId, 'REC');
  });
});
