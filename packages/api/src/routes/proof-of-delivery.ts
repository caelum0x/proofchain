/**
 * /proof-of-delivery — proof-of-delivery receipts (Logistics: DeliveryOracle).
 * Serves the `proof_of_delivery` projection (batch, recipient, signature,
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

const STATUSES = ['pending', 'confirmed', 'disputed'] as const;

const SearchQuery = z.object({
  batchId: Bytes32Schema.optional(),
  recipient: AddressSchema.optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/proof-of-delivery', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'proof_of_delivery', pagination });
  });

  app.get('/proof-of-delivery/search', async (request) => {
    const pagination = paginate(request.query);
    const { batchId, recipient, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'proof-of-delivery search query',
    );
    return listTable(ctx.db, {
      table: 'proof_of_delivery',
      pagination,
      filters: { batch_id: batchId, recipient, status },
    });
  });

  app.get('/proof-of-delivery/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'proof-of-delivery id');
    return getRowOr404(
      ctx.db,
      'proof_of_delivery',
      'id',
      recordId,
      'Proof of delivery',
    );
  });
});
