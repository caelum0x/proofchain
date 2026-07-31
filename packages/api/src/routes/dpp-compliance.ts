/**
 * /dpp-compliance — DPP compliance assessments (DPPComplianceOracle).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createDppComplianceService` (see `../services/dpp-compliance.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createDppComplianceService } from '../services/dpp-compliance.js';

const FilterSchema = z.object({
  status: z.enum(['pending', 'compliant', 'non_compliant', 'exempt']).optional(),
  regulation: z.string().trim().min(1).optional(),
  verifier: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createDppComplianceService(ctx), {
    path: '/dpp-compliance',
    idSchema: NumericIdSchema,
    label: 'DPP compliance record',
    filterSchema: FilterSchema,
  });
});
