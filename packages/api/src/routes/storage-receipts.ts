/**
 * /storage-receipts — warehouse storage receipts (Commodities:
 * StorageReceiptToken). Serves the `storage_receipts` projection (holder,
 * warehouse, commodity, quantity, status) with list / detail / search.
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

const STATUSES = ['active', 'redeemed', 'pledged'] as const;

const SearchQuery = z.object({
  holder: AddressSchema.optional(),
  warehouse_id: z.string().trim().min(1).max(128).optional(),
  commodity: z.string().trim().min(1).max(64).optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/storage-receipts', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'storage_receipts', pagination });
  });

  app.get('/storage-receipts/search', async (request) => {
    const pagination = paginate(request.query);
    const { holder, warehouse_id, commodity, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'storage receipt search query',
    );
    return listTable(ctx.db, {
      table: 'storage_receipts',
      pagination,
      filters: { holder, warehouse_id, commodity, status },
    });
  });

  app.get('/storage-receipts/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'storage receipt id');
    return getRowOr404(
      ctx.db,
      'storage_receipts',
      'id',
      recordId,
      'Storage receipt',
    );
  });
});
