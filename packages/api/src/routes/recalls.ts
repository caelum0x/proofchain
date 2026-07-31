/**
 * /recalls — product recall notices (ProductRecallRegistry).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createRecallsService` (see `../services/recalls.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createRecallsService } from '../services/recalls.js';

const FilterSchema = z.object({
  status: z.enum(['announced', 'active', 'resolved', 'closed']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  manufacturer: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createRecallsService(ctx), {
    path: '/recalls',
    idSchema: NumericIdSchema,
    label: 'Product recall',
    filterSchema: FilterSchema,
  });
});
