/**
 * /grading — commodity quality grades (Commodities: GradingOracle). Serves the
 * `grading` projection (batch, grade, inspector, score) with list / detail /
 * search over the indexed read model.
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

const SearchQuery = z.object({
  batchId: Bytes32Schema.optional(),
  grade: z.string().trim().min(1).max(32).optional(),
  inspector: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/grading', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'grading', pagination });
  });

  app.get('/grading/search', async (request) => {
    const pagination = paginate(request.query);
    const { batchId, grade, inspector } = parseOrThrow(
      SearchQuery,
      request.query,
      'grading search query',
    );
    return listTable(ctx.db, {
      table: 'grading',
      pagination,
      filters: { batch_id: batchId, grade, inspector },
    });
  });

  app.get('/grading/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'grading record id');
    return getRowOr404(ctx.db, 'grading', 'id', recordId, 'Grading record');
  });
});
