/**
 * /disputes — staked-arbiter dispute resolution (M7: DisputeArbitration).
 *
 * Arbiters vote on Disputed deals; a majority either refunds the buyer or
 * releases to the supplier. Serves the `disputes` projection (`open → resolved`,
 * with vote tallies) plus the underlying vote events from the audit log.
 *   - GET /disputes                 → list disputes
 *   - GET /disputes/search          → filter by status/opener
 *   - GET /disputes/:batchId        → one dispute
 *   - GET /disputes/:batchId/votes  → the vote events for that dispute
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import {
  AddressSchema,
  Bytes32Schema,
  getRowOr404,
  listEvents,
  listTable,
  paginate,
  parseOrThrow,
} from '../lib/resourceRoutes.js';

const DISPUTE_STATUSES = ['open', 'resolved'] as const;

const SearchQuery = z.object({
  status: z.enum(DISPUTE_STATUSES).optional(),
  opener: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/disputes', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, {
      table: 'disputes',
      pagination,
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/disputes/search', async (request) => {
    const pagination = paginate(request.query);
    const { status, opener } = parseOrThrow(
      SearchQuery,
      request.query,
      'dispute search query',
    );
    return listTable(ctx.db, {
      table: 'disputes',
      pagination,
      filters: { status, opener },
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/disputes/:batchId', async (request) => {
    const { batchId } = request.params as { batchId: string };
    const id = parseOrThrow(Bytes32Schema, batchId, 'batchId');
    return getRowOr404(ctx.db, 'disputes', 'batch_id', id, 'Dispute');
  });

  app.get('/disputes/:batchId/votes', async (request) => {
    const { batchId } = request.params as { batchId: string };
    const id = parseOrThrow(Bytes32Schema, batchId, 'batchId');
    const pagination = paginate(request.query);
    return listEvents(ctx.db, {
      group: 'governance',
      contract: 'DisputeArbitration',
      eventName: 'Voted',
      filters: { 'args->>batchId': id },
      pagination,
    });
  });
});
