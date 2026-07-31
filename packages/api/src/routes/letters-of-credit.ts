/**
 * /letters-of-credit — documentary Letters of Credit (LetterOfCredit).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createLettersOfCreditService` (see `../services/letters-of-credit.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createLettersOfCreditService } from '../services/letters-of-credit.js';

const FilterSchema = z.object({
  status: z.enum(['issued', 'confirmed', 'presented', 'honored', 'rejected', 'expired']).optional(),
  applicant: AddressSchema.optional(),
  beneficiary: AddressSchema.optional(),
  issuing_bank: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createLettersOfCreditService(ctx), {
    path: '/letters-of-credit',
    idSchema: NumericIdSchema,
    label: 'Letter of credit',
    filterSchema: FilterSchema,
  });
});
