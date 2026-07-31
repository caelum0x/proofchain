/**
 * /guarantees — bank/performance Guarantees (GuaranteeRegistry).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createGuaranteesService` (see `../services/guarantees.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createGuaranteesService } from '../services/guarantees.js';

const FilterSchema = z.object({
  status: z.enum(['issued', 'active', 'called', 'released', 'expired']).optional(),
  kind: z.enum(['bid_bond', 'performance', 'advance_payment', 'warranty', 'financial']).optional(),
  guarantor: AddressSchema.optional(),
  beneficiary: AddressSchema.optional(),
  obligor: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createGuaranteesService(ctx), {
    path: '/guarantees',
    idSchema: NumericIdSchema,
    label: 'Guarantee',
    filterSchema: FilterSchema,
  });
});
