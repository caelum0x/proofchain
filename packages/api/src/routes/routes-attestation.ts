/**
 * /routes-attestation — attested transport routes (Logistics: RouteAttestor).
 * Serves the `route_attestations` projection (carrier, origin/destination,
 * attested distance, status) with list / detail / search over the read model.
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

const STATUSES = ['proposed', 'attested', 'revoked'] as const;

const SearchQuery = z.object({
  carrier: AddressSchema.optional(),
  origin: z.string().trim().min(1).max(64).optional(),
  destination: z.string().trim().min(1).max(64).optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/routes-attestation', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'route_attestations', pagination });
  });

  app.get('/routes-attestation/search', async (request) => {
    const pagination = paginate(request.query);
    const { carrier, origin, destination, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'route attestation search query',
    );
    return listTable(ctx.db, {
      table: 'route_attestations',
      pagination,
      filters: { carrier, origin, destination, status },
    });
  });

  app.get('/routes-attestation/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'route attestation id');
    return getRowOr404(
      ctx.db,
      'route_attestations',
      'id',
      recordId,
      'Route attestation',
    );
  });
});
