/**
 * /containers — shipping containers (Logistics: ContainerRegistry). Serves the
 * `containers` projection (owner, linked batch, seal, status) with list /
 * detail / search over the indexed read model.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import {
  AddressSchema,
  Bytes32Schema,
  IdSchema,
  getRowOr404,
  listTable,
  paginate,
  parseOrThrow,
} from '../lib/resourceRoutes.js';

const STATUSES = ['loaded', 'in_transit', 'delivered', 'empty'] as const;

const SearchQuery = z.object({
  owner: AddressSchema.optional(),
  batchId: Bytes32Schema.optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/containers', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'containers', pagination });
  });

  app.get('/containers/search', async (request) => {
    const pagination = paginate(request.query);
    const { owner, batchId, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'container search query',
    );
    return listTable(ctx.db, {
      table: 'containers',
      pagination,
      filters: { owner, batch_id: batchId, status },
    });
  });

  app.get('/containers/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'container id');
    return getRowOr404(ctx.db, 'containers', 'id', recordId, 'Container');
  });
});
