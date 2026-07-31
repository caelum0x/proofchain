/**
 * /cold-chain — cold-chain custody logs (Logistics: ColdChainOracle). Serves the
 * `cold_chain` projection (per-batch temperature excursions and custody status)
 * with list / detail / search over the indexed read model.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import {
  Bytes32Schema,
  IdSchema,
  getRowOr404,
  listTable,
  paginate,
  parseOrThrow,
} from '../lib/resourceRoutes.js';

const STATUSES = ['active', 'completed', 'breached'] as const;

const SearchQuery = z.object({
  batchId: Bytes32Schema.optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/cold-chain', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'cold_chain', pagination });
  });

  app.get('/cold-chain/search', async (request) => {
    const pagination = paginate(request.query);
    const { batchId, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'cold-chain search query',
    );
    return listTable(ctx.db, {
      table: 'cold_chain',
      pagination,
      filters: { batch_id: batchId, status },
    });
  });

  app.get('/cold-chain/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'cold-chain log id');
    return getRowOr404(ctx.db, 'cold_chain', 'id', recordId, 'Cold-chain log');
  });
});
