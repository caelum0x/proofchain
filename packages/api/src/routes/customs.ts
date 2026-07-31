/**
 * /customs — customs declarations (CustomsDeclaration).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createCustomsService` (see `../services/customs.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createCustomsService } from '../services/customs.js';

const FilterSchema = z.object({
  status: z.enum(['lodged', 'accepted', 'inspected', 'cleared', 'held', 'rejected']).optional(),
  direction: z.enum(['import', 'export']).optional(),
  port: z.string().trim().min(1).optional(),
  declarant: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createCustomsService(ctx), {
    path: '/customs',
    idSchema: NumericIdSchema,
    label: 'Customs declaration',
    filterSchema: FilterSchema,
  });
});
