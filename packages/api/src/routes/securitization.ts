/**
 * /securitization — receivable securitization pools (ReceivableSecuritization).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createSecuritizationService` (see `../services/securitization.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createSecuritizationService } from '../services/securitization.js';

const FilterSchema = z.object({
  status: z.enum(['structured', 'issued', 'servicing', 'wound_down']).optional(),
  originator: AddressSchema.optional(),
  spv: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createSecuritizationService(ctx), {
    path: '/securitization',
    idSchema: NumericIdSchema,
    label: 'Securitization pool',
    filterSchema: FilterSchema,
  });
});
