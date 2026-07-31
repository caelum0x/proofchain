/**
 * /phytosanitary — Phytosanitary Certificates (PhytosanitaryCertificate).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createPhytosanitaryService` (see `../services/phytosanitary.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createPhytosanitaryService } from '../services/phytosanitary.js';

const FilterSchema = z.object({
  status: z.enum(['issued', 'inspected', 'verified', 'revoked', 'expired']).optional(),
  origin_country: z.string().trim().min(1).optional(),
  destination_country: z.string().trim().min(1).optional(),
  exporter: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createPhytosanitaryService(ctx), {
    path: '/phytosanitary',
    idSchema: NumericIdSchema,
    label: 'Phytosanitary certificate',
    filterSchema: FilterSchema,
  });
});
