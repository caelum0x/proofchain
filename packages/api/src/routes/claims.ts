/**
 * /claims — insurance claims (M6: ClaimsProcessor). Serves the `claims`
 * projection (`filed → approved | paid | rejected`). List / detail / search by
 * policy, batch, claimant, or status.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import {
  AddressSchema,
  Bytes32Schema,
  IdSchema,
  getRowOr404,
  listTable,
  paginate,
  parseOrThrow,
} from '../lib/resourceRoutes.js';

const CLAIM_STATUSES = ['filed', 'approved', 'paid', 'rejected'] as const;

const SearchQuery = z.object({
  policyId: IdSchema.optional(),
  batchId: Bytes32Schema.optional(),
  claimant: AddressSchema.optional(),
  status: z.enum(CLAIM_STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/claims', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, {
      table: 'claims',
      pagination,
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/claims/search', async (request) => {
    const pagination = paginate(request.query);
    const { policyId, batchId, claimant, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'claim search query',
    );
    return listTable(ctx.db, {
      table: 'claims',
      pagination,
      filters: {
        policy_id: policyId,
        batch_id: batchId,
        claimant,
        status,
      },
      order: { column: 'created_at', ascending: false },
    });
  });

  app.get('/claims/:id', async (request) => {
    const { id } = request.params as { id: string };
    const claimId = parseOrThrow(IdSchema, id, 'claim id');
    return getRowOr404(ctx.db, 'claims', 'id', claimId, 'Claim');
  });
});
