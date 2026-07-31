/**
 * /green-bonds — issued green bonds (Energy/ESG: GreenBondRegistry). Serves the
 * `green_bonds` projection (issuer, principal, currency, coupon, status) with
 * list / detail / search over the indexed read model.
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

const STATUSES = ['issued', 'active', 'matured', 'defaulted'] as const;

const SearchQuery = z.object({
  issuer: AddressSchema.optional(),
  currency: z.string().trim().min(1).max(16).optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/green-bonds', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'green_bonds', pagination });
  });

  app.get('/green-bonds/search', async (request) => {
    const pagination = paginate(request.query);
    const { issuer, currency, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'green bond search query',
    );
    return listTable(ctx.db, {
      table: 'green_bonds',
      pagination,
      filters: { issuer, currency, status },
    });
  });

  app.get('/green-bonds/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'green bond id');
    return getRowOr404(ctx.db, 'green_bonds', 'id', recordId, 'Green bond');
  });
});
