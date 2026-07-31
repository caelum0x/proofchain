/**
 * /freight — freight shipments (Logistics: FreightRegistry). Serves the
 * `freight` projection (booking, leg, carrier, status) with list / detail /
 * search over the indexed read model.
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

const STATUSES = ['booked', 'in_transit', 'delivered', 'cancelled'] as const;

const SearchQuery = z.object({
  shipper: AddressSchema.optional(),
  carrier: AddressSchema.optional(),
  mode: z.string().trim().min(1).max(32).optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/freight', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'freight', pagination });
  });

  app.get('/freight/search', async (request) => {
    const pagination = paginate(request.query);
    const { shipper, carrier, mode, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'freight search query',
    );
    return listTable(ctx.db, {
      table: 'freight',
      pagination,
      filters: { shipper, carrier, mode, status },
    });
  });

  app.get('/freight/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'freight id');
    return getRowOr404(ctx.db, 'freight', 'id', recordId, 'Freight shipment');
  });
});
