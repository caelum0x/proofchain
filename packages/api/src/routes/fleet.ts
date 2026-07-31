/**
 * /fleet — logistics fleet vehicles (Logistics: FleetRegistry). Serves the
 * `fleet` projection (operator, vehicle type, capacity, status) with list /
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

const STATUSES = ['active', 'maintenance', 'retired'] as const;

const SearchQuery = z.object({
  operator: AddressSchema.optional(),
  vehicle_type: z.string().trim().min(1).max(32).optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/fleet', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'fleet', pagination });
  });

  app.get('/fleet/search', async (request) => {
    const pagination = paginate(request.query);
    const { operator, vehicle_type, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'fleet search query',
    );
    return listTable(ctx.db, {
      table: 'fleet',
      pagination,
      filters: { operator, vehicle_type, status },
    });
  });

  app.get('/fleet/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'fleet vehicle id');
    return getRowOr404(ctx.db, 'fleet', 'id', recordId, 'Fleet vehicle');
  });
});
