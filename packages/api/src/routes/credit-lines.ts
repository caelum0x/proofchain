/**
 * /credit-lines — revolving Credit Lines (CreditLineManager).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createCreditLinesService` (see `../services/credit-lines.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createCreditLinesService } from '../services/credit-lines.js';

const FilterSchema = z.object({
  status: z.enum(['opened', 'active', 'suspended', 'closed', 'defaulted']).optional(),
  borrower: AddressSchema.optional(),
  lender: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createCreditLinesService(ctx), {
    path: '/credit-lines',
    idSchema: NumericIdSchema,
    label: 'Credit line',
    filterSchema: FilterSchema,
  });
});
