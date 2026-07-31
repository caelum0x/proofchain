/**
 * /quality-inspections — physical quality inspections (Data: InspectionOracle).
 * Serves the `quality_inspections` projection (batch, inspector, result,
 * status) with list / detail / search over the indexed read model.
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

const RESULTS = ['pass', 'fail', 'conditional'] as const;
const STATUSES = ['scheduled', 'completed', 'cancelled'] as const;

const SearchQuery = z.object({
  batchId: Bytes32Schema.optional(),
  inspector: AddressSchema.optional(),
  result: z.enum(RESULTS).optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/quality-inspections', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'quality_inspections', pagination });
  });

  app.get('/quality-inspections/search', async (request) => {
    const pagination = paginate(request.query);
    const { batchId, inspector, result, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'quality inspection search query',
    );
    return listTable(ctx.db, {
      table: 'quality_inspections',
      pagination,
      filters: { batch_id: batchId, inspector, result, status },
    });
  });

  app.get('/quality-inspections/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'quality inspection id');
    return getRowOr404(
      ctx.db,
      'quality_inspections',
      'id',
      recordId,
      'Quality inspection',
    );
  });
});
