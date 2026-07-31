/**
 * /carbon — tokenized carbon offsets (M8: CarbonCreditToken, OffsetMarketplace,
 * SustainabilityOracle). Serves the `carbon` projection (per project/batch CO2e
 * emitted vs retired). List / detail / search by project or batch.
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

const SearchQuery = z.object({
  projectId: z.string().trim().min(1).max(128).optional(),
  batchId: Bytes32Schema.optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/carbon', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, {
      table: 'carbon',
      pagination,
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/carbon/search', async (request) => {
    const pagination = paginate(request.query);
    const { projectId, batchId } = parseOrThrow(
      SearchQuery,
      request.query,
      'carbon search query',
    );
    return listTable(ctx.db, {
      table: 'carbon',
      pagination,
      filters: { project_id: projectId, batch_id: batchId },
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/carbon/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'carbon record id');
    return getRowOr404(ctx.db, 'carbon', 'id', recordId, 'Carbon record');
  });
});
