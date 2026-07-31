/**
 * /lab-tests — laboratory test results (Data: LabTestOracle). Serves the
 * `lab_tests` projection (batch, lab, analyte, result, status) with list /
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

const RESULTS = ['pass', 'fail', 'inconclusive'] as const;
const STATUSES = ['pending', 'reported', 'retracted'] as const;

const SearchQuery = z.object({
  batchId: Bytes32Schema.optional(),
  lab: AddressSchema.optional(),
  result: z.enum(RESULTS).optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/lab-tests', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'lab_tests', pagination });
  });

  app.get('/lab-tests/search', async (request) => {
    const pagination = paginate(request.query);
    const { batchId, lab, result, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'lab test search query',
    );
    return listTable(ctx.db, {
      table: 'lab_tests',
      pagination,
      filters: { batch_id: batchId, lab, result, status },
    });
  });

  app.get('/lab-tests/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'lab test id');
    return getRowOr404(ctx.db, 'lab_tests', 'id', recordId, 'Lab test');
  });
});
