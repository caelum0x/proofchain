/**
 * /safety-training — safety-training completions (Workforce: SafetyTraining).
 * Serves the `safety_training` projection (worker, course, expiry, status) with
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

const STATUSES = ['completed', 'expired', 'in_progress'] as const;

const SearchQuery = z.object({
  worker: AddressSchema.optional(),
  course: z.string().trim().min(1).max(64).optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/safety-training', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'safety_training', pagination });
  });

  app.get('/safety-training/search', async (request) => {
    const pagination = paginate(request.query);
    const { worker, course, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'safety training search query',
    );
    return listTable(ctx.db, {
      table: 'safety_training',
      pagination,
      filters: { worker, course, status },
    });
  });

  app.get('/safety-training/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'safety training id');
    return getRowOr404(
      ctx.db,
      'safety_training',
      'id',
      recordId,
      'Safety training record',
    );
  });
});
