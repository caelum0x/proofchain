/**
 * /worker-credentials — verifiable worker credentials (Workforce:
 * CredentialRegistry). Serves the `worker_credentials` projection (worker,
 * issuer, type, status) with list / detail / search over the indexed read model.
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

const STATUSES = ['active', 'expired', 'revoked'] as const;

const SearchQuery = z.object({
  worker: AddressSchema.optional(),
  issuer: AddressSchema.optional(),
  credential_type: z.string().trim().min(1).max(64).optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/worker-credentials', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'worker_credentials', pagination });
  });

  app.get('/worker-credentials/search', async (request) => {
    const pagination = paginate(request.query);
    const { worker, issuer, credential_type, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'worker credential search query',
    );
    return listTable(ctx.db, {
      table: 'worker_credentials',
      pagination,
      filters: { worker, issuer, credential_type, status },
    });
  });

  app.get('/worker-credentials/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'worker credential id');
    return getRowOr404(
      ctx.db,
      'worker_credentials',
      'id',
      recordId,
      'Worker credential',
    );
  });
});
