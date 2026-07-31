/**
 * /passports — EU Digital Product Passports (DigitalProductPassport).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createPassportsService` (see `../services/passports.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createPassportsService } from '../services/passports.js';

const FilterSchema = z.object({
  status: z.enum(['issued', 'active', 'transferred', 'retired', 'recycled']).optional(),
  owner: AddressSchema.optional(),
  manufacturer: AddressSchema.optional(),
  gtin: z.string().trim().min(1).optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createPassportsService(ctx), {
    path: '/passports',
    idSchema: NumericIdSchema,
    label: 'Passport',
    filterSchema: FilterSchema,
  });
});
