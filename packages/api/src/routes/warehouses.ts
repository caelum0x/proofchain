/**
 * /warehouses — bonded/general warehouses (Logistics: WarehouseRegistry). Serves
 * the `warehouses` projection (operator, region, capacity, status) with list /
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

const STATUSES = ['active', 'inactive'] as const;

const SearchQuery = z.object({
  operator: AddressSchema.optional(),
  region: z.string().trim().min(1).max(64).optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/warehouses', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'warehouses', pagination });
  });

  app.get('/warehouses/search', async (request) => {
    const pagination = paginate(request.query);
    const { operator, region, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'warehouse search query',
    );
    return listTable(ctx.db, {
      table: 'warehouses',
      pagination,
      filters: { operator, region, status },
    });
  });

  app.get('/warehouses/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'warehouse id');
    return getRowOr404(ctx.db, 'warehouses', 'id', recordId, 'Warehouse');
  });
});
