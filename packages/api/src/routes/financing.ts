/**
 * /financing — invoice financing listings (M5: InvoiceFinancing).
 *
 * A supplier lists an attested receivable at a discount; a lender funds it and
 * becomes the escrow payee; on release the lender is repaid and the remainder
 * goes to the supplier. The `financing_listings` projection tracks that lifecycle
 * (`listed → funded → claimed | cancelled`). List / detail / search over it.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import {
  AddressSchema,
  Bytes32Schema,
  getRowOr404,
  listTable,
  paginate,
  parseOrThrow,
} from '../lib/resourceRoutes.js';

const LISTING_STATUSES = ['listed', 'funded', 'claimed', 'cancelled'] as const;

const SearchQuery = z.object({
  supplier: AddressSchema.optional(),
  lender: AddressSchema.optional(),
  status: z.enum(LISTING_STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/financing', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, {
      table: 'financing_listings',
      pagination,
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/financing/search', async (request) => {
    const pagination = paginate(request.query);
    const { supplier, lender, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'financing search query',
    );
    return listTable(ctx.db, {
      table: 'financing_listings',
      pagination,
      filters: { supplier, lender, status },
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/financing/:batchId', async (request) => {
    const { batchId } = request.params as { batchId: string };
    const id = parseOrThrow(Bytes32Schema, batchId, 'batchId');
    return getRowOr404(
      ctx.db,
      'financing_listings',
      'batch_id',
      id,
      'Financing listing',
    );
  });
});
