/**
 * /labor-compliance — labor-compliance attestations (Workforce:
 * LaborComplianceOracle). Serves the `labor_compliance` projection (employer,
 * jurisdiction, standard, status) with list / detail / search.
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

const STATUSES = ['compliant', 'flagged', 'remediated'] as const;

const SearchQuery = z.object({
  employer: AddressSchema.optional(),
  jurisdiction: z.string().trim().min(1).max(64).optional(),
  status: z.enum(STATUSES).optional(),
});

export default defineRoutes((app, ctx) => {
  app.get('/labor-compliance', async (request) => {
    const pagination = paginate(request.query);
    return listTable(ctx.db, { table: 'labor_compliance', pagination });
  });

  app.get('/labor-compliance/search', async (request) => {
    const pagination = paginate(request.query);
    const { employer, jurisdiction, status } = parseOrThrow(
      SearchQuery,
      request.query,
      'labor compliance search query',
    );
    return listTable(ctx.db, {
      table: 'labor_compliance',
      pagination,
      filters: { employer, jurisdiction, status },
    });
  });

  app.get('/labor-compliance/:id', async (request) => {
    const { id } = request.params as { id: string };
    const recordId = parseOrThrow(IdSchema, id, 'labor compliance record id');
    return getRowOr404(
      ctx.db,
      'labor_compliance',
      'id',
      recordId,
      'Labor compliance record',
    );
  });
});
