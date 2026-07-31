/**
 * /bills-of-exchange — negotiable Bills of Exchange (BillOfExchange).
 *
 * A thin HTTP adapter: it validates query/params with zod and delegates
 * list/detail/search to `createBillsOfExchangeService` (see `../services/bills-of-exchange.ts`),
 * wrapping every result in the `{ success, data, error }` envelope. Endpoint
 * wiring is provided by `registerResourceRoutes`.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import { AddressSchema, NumericIdSchema } from '../lib/resourceRoutes.js';
import { registerResourceRoutes } from '../lib/serviceRoutes.js';
import { createBillsOfExchangeService } from '../services/bills-of-exchange.js';

const FilterSchema = z.object({
  status: z.enum(['drawn', 'accepted', 'endorsed', 'paid', 'dishonored']).optional(),
  drawer: AddressSchema.optional(),
  drawee: AddressSchema.optional(),
  payee: AddressSchema.optional(),
});

export default defineRoutes((app, ctx) => {
  registerResourceRoutes(app, createBillsOfExchangeService(ctx), {
    path: '/bills-of-exchange',
    idSchema: NumericIdSchema,
    label: 'Bill of exchange',
    filterSchema: FilterSchema,
  });
});
