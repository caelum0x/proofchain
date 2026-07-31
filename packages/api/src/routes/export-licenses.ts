/**
 * /export-licenses — export license grants (ExportLicenseRegistry).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createExportLicensesService` (see `../services/export-licenses.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createExportLicensesService } from '../services/export-licenses.js';

const FilterSchema = z.object({
  status: z.enum(['applied', 'granted', 'denied', 'suspended', 'expired']).optional(),
  destination_country: z.string().trim().min(1).optional(),
  exporter: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createExportLicensesService(ctx), {
    path: '/export-licenses',
    idSchema: NumericIdSchema,
    label: 'Export license',
    filterSchema: FilterSchema,
  });
});
