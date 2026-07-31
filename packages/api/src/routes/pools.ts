/**
 * /pools — pooled lender capital (M5: FinancingPool + LenderVault).
 *
 * A FinancingPool auto-funds eligible receivables by risk grade; LenderVault
 * tokenizes pool shares (ERC4626-style). The `pools` projection tracks each
 * pool's manager, total assets/shares and risk grade. List / detail / search.
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

const SearchQuery = z.object({
  manager: AddressSchema.optional(),
  grade: z.coerce.number().int().min(0).max(255).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/pools', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, {
      table: 'pools',
      pagination,
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/pools/search', async (request) => {
    const pagination = paginate(request.query);
    const { manager, grade } = parseOrThrow(
      SearchQuery,
      request.query,
      'pool search query',
    );
    return listTable(ctx.db, {
      table: 'pools',
      pagination,
      filters: { manager, risk_grade: grade },
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/pools/:id', async (request) => {
    const { id } = request.params as { id: string };
    const poolId = parseOrThrow(IdSchema, id, 'pool id');
    return getRowOr404(ctx.db, 'pools', 'id', poolId, 'Pool');
  });
});
