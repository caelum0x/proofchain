/**
 * /repairability — DPP repairability indices (RepairabilityIndex).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createRepairabilityService` (see `../services/repairability.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createRepairabilityService } from '../services/repairability.js';

const FilterSchema = z.object({
  status: z.enum(['draft', 'published']).optional(),
  grade: z.string().trim().min(1).optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createRepairabilityService(ctx), {
    path: '/repairability',
    idSchema: NumericIdSchema,
    label: 'Repairability score',
    filterSchema: FilterSchema,
  });
});
