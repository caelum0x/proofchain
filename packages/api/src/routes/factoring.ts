/**
 * /factoring — receivable Factoring agreements (FactoringAgreement).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createFactoringService` (see `../services/factoring.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createFactoringService } from '../services/factoring.js';

const FilterSchema = z.object({
  status: z.enum(['proposed', 'active', 'collected', 'defaulted', 'closed']).optional(),
  seller: AddressSchema.optional(),
  factor: AddressSchema.optional(),
  debtor: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createFactoringService(ctx), {
    path: '/factoring',
    idSchema: NumericIdSchema,
    label: 'Factoring agreement',
    filterSchema: FilterSchema,
  });
});
