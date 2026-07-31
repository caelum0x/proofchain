/**
 * /certificates-origin — Certificates of Origin (CertificateOfOrigin).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createCertificatesOriginService` (see `../services/certificates-origin.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createCertificatesOriginService } from '../services/certificates-origin.js';

const FilterSchema = z.object({
  status: z.enum(['issued', 'verified', 'revoked', 'expired']).optional(),
  origin_country: z.string().trim().min(1).optional(),
  hs_code: z.string().trim().min(1).optional(),
  exporter: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createCertificatesOriginService(ctx), {
    path: '/certificates-origin',
    idSchema: NumericIdSchema,
    label: 'Certificate of origin',
    filterSchema: FilterSchema,
  });
});
