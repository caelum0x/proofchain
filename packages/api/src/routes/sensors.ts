/**
 * /sensors — registered IoT sensors (Data: SensorRegistry). Serves the
 * `sensors` projection (owner, type, location, status) with list / detail /
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

const STATUSES = ['active', 'inactive', 'faulty'] as const;

const SearchQuery = z.object({
  owner: AddressSchema.optional(),
  sensor_type: z.string().trim().min(1).max(32).optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/sensors', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'sensors', pagination });
  });

  app.get('/sensors/search', async (request) => {
    const pagination = paginate(request.query);
    const { owner, sensor_type, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'sensor search query',
    );
    return listTable(ctx.db, {
      table: 'sensors',
      pagination,
      filters: { owner, sensor_type, status },
    });
  });

  app.get('/sensors/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'sensor id');
    return getRowOr404(ctx.db, 'sensors', 'id', recordId, 'Sensor');
  });
});
