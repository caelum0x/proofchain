/**
 * /skills — attested worker skills (Workforce: SkillRegistry). Serves the
 * `skills` projection (worker, skill, level, endorser) with list / detail /
 * search over the indexed read model.
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

const LEVELS = ['novice', 'intermediate', 'expert', 'master'] as const;

const SearchQuery = z.object({
  worker: AddressSchema.optional(),
  skill: z.string().trim().min(1).max(64).optional(),
  level: z.enum(LEVELS).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/skills', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'skills', pagination });
  });

  app.get('/skills/search', async (request) => {
    const pagination = paginate(request.query);
    const { worker, skill, level } = parseOrThrow(
      SearchQuery,
      request.query,
      'skill search query',
    );
    return listTable(ctx.db, {
      table: 'skills',
      pagination,
      filters: { worker, skill, level },
    });
  });

  app.get('/skills/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'skill id');
    return getRowOr404(ctx.db, 'skills', 'id', recordId, 'Skill');
  });
});
