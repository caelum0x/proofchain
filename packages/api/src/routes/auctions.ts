/**
 * /auctions — English auctions for tokenized assets (M9: AuctionHouse).
 *
 * Serves the `auctions` projection (`active → settled | cancelled`, tracking the
 * highest bid/bidder and end time) plus the raw bid events from the audit log.
 *   - GET /auctions             → list auctions
 *   - GET /auctions/search      → filter by status/seller
 *   - GET /auctions/:id         → one auction
 *   - GET /auctions/:id/bids    → bid history for an auction
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import {
  AddressSchema,
  IdSchema,
  getRowOr404,
  listEvents,
  listTable,
  paginate,
  parseOrThrow,
} from '../lib/resourceRoutes.js';

const AUCTION_STATUSES = ['active', 'settled', 'cancelled'] as const;

const SearchQuery = z.object({
  status: z.enum(AUCTION_STATUSES).optional(),
  seller: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/auctions', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, {
      table: 'auctions',
      pagination,
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/auctions/search', async (request) => {
    const pagination = paginate(request.query);
    const { status, seller } = parseOrThrow(
      SearchQuery,
      request.query,
      'auction search query',
    );
    return listTable(ctx.db, {
      table: 'auctions',
      pagination,
      filters: { status, seller },
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/auctions/:id/bids', async (request) => {
    const { id } = request.params as { id: string };
    const auctionId = parseOrThrow(IdSchema, id, 'auction id');
    const pagination = paginate(request.query);
    return listEvents(ctx.db, {
      group: 'marketplace',
      contract: 'AuctionHouse',
      eventName: 'Bid',
      filters: { 'args->>auctionId': auctionId },
      pagination,
    });
  });

  app.get('/auctions/:id', async (request) => {
    const { id } = request.params as { id: string };
    const auctionId = parseOrThrow(IdSchema, id, 'auction id');
    return getRowOr404(ctx.db, 'auctions', 'id', auctionId, 'Auction');
  });
});
