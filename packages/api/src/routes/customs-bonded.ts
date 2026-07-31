/**
 * /customs-bonded — customs bonded-warehouse entries (Compliance/Logistics:
 * CustomsBondedRegistry). Serves the `customs_bonded` projection (importer,
 * warehouse, duty bond, status) with list / detail / search over the read model.
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

const STATUSES = ['bonded', 'released', 'seized'] as const;

const SearchQuery = z.object({
  importer: AddressSchema.optional(),
  warehouse_id: z.string().trim().min(1).max(128).optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/customs-bonded', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'customs_bonded', pagination });
  });

  app.get('/customs-bonded/search', async (request) => {
    const pagination = paginate(request.query);
    const { importer, warehouse_id, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'customs bonded search query',
    );
    return listTable(ctx.db, {
      table: 'customs_bonded',
      pagination,
      filters: { importer, warehouse_id, status },
    });
  });

  app.get('/customs-bonded/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'customs bonded entry id');
    return getRowOr404(
      ctx.db,
      'customs_bonded',
      'id',
      recordId,
      'Customs bonded entry',
    );
  });
});
