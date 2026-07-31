/**
 * /payroll — on-chain payroll runs (Workforce: PayrollDisburser). Serves the
 * `payroll` projection (worker, employer, period, amount, status) with list /
 * detail / search over the indexed read model.
 */
import { z } from 'zod';
import { defineRoutes } from '../lib/route.js';
import {
  AddressSchema,
  IdSchema,
  getRowOr404,
  listTable,
  paginate,
  parseOrThrow,
} from '../lib/resourceRoutes.js';

const STATUSES = ['scheduled', 'paid', 'failed'] as const;

const SearchQuery = z.object({
  worker: AddressSchema.optional(),
  employer: AddressSchema.optional(),
  period: z.string().trim().min(1).max(16).optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/payroll', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'payroll', pagination });
  });

  app.get('/payroll/search', async (request) => {
    const pagination = paginate(request.query);
    const { worker, employer, period, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'payroll search query',
    );
    return listTable(ctx.db, {
      table: 'payroll',
      pagination,
      filters: { worker, employer, period, status },
    });
  });

  app.get('/payroll/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'payroll run id');
    return getRowOr404(ctx.db, 'payroll', 'id', recordId, 'Payroll run');
  });
});
