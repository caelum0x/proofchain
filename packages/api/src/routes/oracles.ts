/**
 * /oracles — registered data oracles (Data: OracleRegistry). Serves the
 * `oracles` projection (operator, feed type, endpoint, status) with list /
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

const STATUSES = ['active', 'paused', 'deprecated'] as const;

const SearchQuery = z.object({
  operator: AddressSchema.optional(),
  feed_type: z.string().trim().min(1).max(32).optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/oracles', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'oracles', pagination });
  });

  app.get('/oracles/search', async (request) => {
    const pagination = paginate(request.query);
    const { operator, feed_type, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'oracle search query',
    );
    return listTable(ctx.db, {
      table: 'oracles',
      pagination,
      filters: { operator, feed_type, status },
    });
  });

  app.get('/oracles/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'oracle id');
    return getRowOr404(ctx.db, 'oracles', 'id', recordId, 'Oracle');
  });
});
