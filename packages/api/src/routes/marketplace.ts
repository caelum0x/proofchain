/**
 * /marketplace — generic asset listings (M9: ListingRegistry,
 * FinancingMarketplace, OrderBook). Serves the `listings` projection
 * (`active → cancelled | filled`). List / detail / search by seller/kind/status.
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

const LISTING_STATUSES = ['active', 'cancelled', 'filled'] as const;

const SearchQuery = z.object({
  seller: AddressSchema.optional(),
  kind: z.string().trim().min(1).max(64).optional(),
  status: z.enum(LISTING_STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/marketplace', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, {
      table: 'listings',
      pagination,
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/marketplace/search', async (request) => {
    const pagination = paginate(request.query);
    const { seller, kind, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'marketplace search query',
    );
    return listTable(ctx.db, {
      table: 'listings',
      pagination,
      filters: { seller, kind, status },
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/marketplace/:id', async (request) => {
    const { id } = request.params as { id: string };
    const listingId = parseOrThrow(IdSchema, id, 'listing id');
    return getRowOr404(ctx.db, 'listings', 'id', listingId, 'Listing');
  });
});
