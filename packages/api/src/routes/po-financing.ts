/**
 * /po-financing — purchase-order financing (PurchaseOrderFinancing).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createPoFinancingService` (see `../services/po-financing.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createPoFinancingService } from '../services/po-financing.js';

const FilterSchema = z.object({
  status: z.enum(['requested', 'approved', 'funded', 'fulfilled', 'repaid', 'defaulted']).optional(),
  buyer: AddressSchema.optional(),
  supplier: AddressSchema.optional(),
  financier: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createPoFinancingService(ctx), {
    path: '/po-financing',
    idSchema: NumericIdSchema,
    label: 'PO financing',
    filterSchema: FilterSchema,
  });
});
