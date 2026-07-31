/**
 * /dynamic-discounting — early-payment Dynamic Discounting offers (DynamicDiscounting).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createDynamicDiscountingService` (see `../services/dynamic-discounting.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createDynamicDiscountingService } from '../services/dynamic-discounting.js';

const FilterSchema = z.object({
  status: z.enum(['offered', 'accepted', 'settled', 'expired']).optional(),
  buyer: AddressSchema.optional(),
  supplier: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createDynamicDiscountingService(ctx), {
    path: '/dynamic-discounting',
    idSchema: NumericIdSchema,
    label: 'Dynamic discount offer',
    filterSchema: FilterSchema,
  });
});
