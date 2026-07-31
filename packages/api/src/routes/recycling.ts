/**
 * /recycling — DPP recycling records (RecyclingRegistry).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createRecyclingService` (see `../services/recycling.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createRecyclingService } from '../services/recycling.js';

const FilterSchema = z.object({
  status: z.enum(['collected', 'processed', 'recovered', 'disposed']).optional(),
  method: z.enum(['mechanical', 'chemical', 'reuse']).optional(),
  recycler: AddressSchema.optional(),
  token_id: z.string().trim().min(1).optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createRecyclingService(ctx), {
    path: '/recycling',
    idSchema: NumericIdSchema,
    label: 'Recycling record',
    filterSchema: FilterSchema,
  });
});
