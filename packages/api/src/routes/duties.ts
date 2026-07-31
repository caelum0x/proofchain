/**
 * /duties — duty & tariff calculations (DutyAndTariffCalculator).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createDutiesService` (see `../services/duties.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createDutiesService } from '../services/duties.js';

const FilterSchema = z.object({
  status: z.enum(['draft', 'calculated', 'assessed', 'paid']).optional(),
  hs_code: z.string().trim().min(1).optional(),
  origin_country: z.string().trim().min(1).optional(),
  declarant: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createDutiesService(ctx), {
    path: '/duties',
    idSchema: NumericIdSchema,
    label: 'Duty calculation',
    filterSchema: FilterSchema,
  });
});
