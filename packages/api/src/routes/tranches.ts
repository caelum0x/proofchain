/**
 * /tranches — securitization tranche tokens (TrancheToken).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createTranchesService` (see `../services/tranches.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createTranchesService } from '../services/tranches.js';

const FilterSchema = z.object({
  status: z.enum(['issued', 'performing', 'defaulted', 'redeemed']).optional(),
  pool_id: z.string().trim().min(1).optional(),
  token: AddressSchema.optional(),
  seniority: z.string().trim().min(1).optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createTranchesService(ctx), {
    path: '/tranches',
    idSchema: NumericIdSchema,
    label: 'Tranche',
    filterSchema: FilterSchema,
  });
});
