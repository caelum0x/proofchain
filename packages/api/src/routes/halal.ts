/**
 * /halal — Halal Certifications (HalalCertification).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createHalalService` (see `../services/halal.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createHalalService } from '../services/halal.js';

const FilterSchema = z.object({
  status: z.enum(['issued', 'valid', 'suspended', 'revoked', 'expired']).optional(),
  scheme: z.string().trim().min(1).optional(),
  certifier: AddressSchema.optional(),
  producer: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createHalalService(ctx), {
    path: '/halal',
    idSchema: NumericIdSchema,
    label: 'Halal certification',
    filterSchema: FilterSchema,
  });
});
