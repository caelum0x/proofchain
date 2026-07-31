/**
 * /dpp-lifecycle — DPP lifecycle events (DPPLifecycleRegistry).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createDppLifecycleService` (see `../services/dpp-lifecycle.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createDppLifecycleService } from '../services/dpp-lifecycle.js';

const FilterSchema = z.object({
  stage: z.enum(['manufactured', 'distributed', 'sold', 'repaired', 'recycled', 'disposed']).optional(),
  token_id: z.string().trim().min(1).optional(),
  actor: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createDppLifecycleService(ctx), {
    path: '/dpp-lifecycle',
    idSchema: NumericIdSchema,
    label: 'DPP lifecycle event',
    filterSchema: FilterSchema,
  });
});
