/**
 * /aml — AML risk records (AMLRegistry).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createAmlService` (see `../services/aml.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createAmlService } from '../services/aml.js';

const FilterSchema = z.object({
  status: z.enum(['cleared', 'review', 'flagged', 'blocked']).optional(),
  risk_level: z.enum(['low', 'medium', 'high']).optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createAmlService(ctx), {
    path: '/aml',
    idSchema: AddressSchema,
    label: 'AML record',
    filterSchema: FilterSchema,
  });
});
