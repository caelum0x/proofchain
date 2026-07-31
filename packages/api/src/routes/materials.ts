/**
 * /materials — DPP material compositions (MaterialComposition).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createMaterialsService` (see `../services/materials.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createMaterialsService } from '../services/materials.js';

const FilterSchema = z.object({
  token_id: z.string().trim().min(1).optional(),
  material: z.string().trim().min(1).optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createMaterialsService(ctx), {
    path: '/materials',
    idSchema: NumericIdSchema,
    label: 'Material composition',
    filterSchema: FilterSchema,
  });
});
