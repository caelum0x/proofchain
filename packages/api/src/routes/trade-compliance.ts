/**
 * /trade-compliance — trade compliance engine checks (TradeComplianceEngine).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createTradeComplianceService` (see `../services/trade-compliance.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createTradeComplianceService } from '../services/trade-compliance.js';

const FilterSchema = z.object({
  status: z.enum(['pending', 'passed', 'failed', 'waived']).optional(),
  jurisdiction: z.string().trim().min(1).optional(),
  subject: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createTradeComplianceService(ctx), {
    path: '/trade-compliance',
    idSchema: NumericIdSchema,
    label: 'Trade compliance check',
    filterSchema: FilterSchema,
  });
});
