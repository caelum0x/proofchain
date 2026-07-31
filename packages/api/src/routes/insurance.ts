/**
 * /insurance — shipment/credit insurance policies (M6: PolicyManager,
 * InsurancePool). Serves the `policies` projection (`active → expired | claimed
 * | cancelled`). List / detail / search by holder, batch, or status.
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

const POLICY_STATUSES = ['active', 'expired', 'claimed', 'cancelled'] as const;

const SearchQuery = z.object({
  holder: AddressSchema.optional(),
  batchId: Bytes32Schema.optional(),
  status: z.enum(POLICY_STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/insurance', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, {
      table: 'policies',
      pagination,
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/insurance/search', async (request) => {
    const pagination = paginate(request.query);
    const { holder, batchId, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'insurance search query',
    );
    return listTable(ctx.db, {
      table: 'policies',
      pagination,
      filters: { holder, batch_id: batchId, status },
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/insurance/:id', async (request) => {
    const { id } = request.params as { id: string };
    const policyId = parseOrThrow(IdSchema, id, 'policy id');
    return getRowOr404(ctx.db, 'policies', 'id', policyId, 'Policy');
  });
});
