/**
 * /sanctions — sanctions screening results (SanctionsScreening).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createSanctionsService` (see `../services/sanctions.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createSanctionsService } from '../services/sanctions.js';

const FilterSchema = z.object({
  status: z.enum(['cleared', 'flagged', 'blocked', 'pending']).optional(),
  list_name: z.string().trim().min(1).optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createSanctionsService(ctx), {
    path: '/sanctions',
    idSchema: AddressSchema,
    label: 'Sanctions screening',
    filterSchema: FilterSchema,
  });
});
