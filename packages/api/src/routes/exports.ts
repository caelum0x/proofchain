/**
 * /exports — read-model data export as CSV or JSON.
 *
 * Powers the web app's "Export" actions. `format=csv` streams a downloadable
 * `text/csv` attachment; `format=json` (default) returns the rows in the
 * standard envelope. Only whitelisted tables are exportable and every export is
 * bounded by the shared pagination clamps (see `ExportsService`).
 *   - GET /exports              → the exportable resources
 *   - GET /exports/:resource    → export a resource (?format=csv|json)
 */
import { z } from 'zod';
import { ok } from '../lib/envelope.js';
import { parsePagination } from '../lib/pagination.js';
import { parseOr400 } from '../lib/reads.js';
import { defineRoutes } from '../lib/route.js';
import { createExportsService } from '../services/exports.js';

const ResourceParams = z.object({ resource: z.string().trim().min(1) });
const FormatQuery = z.object({
  format: z.enum(['csv', 'json']).default('json'),
});

export default defineRoutes((app, ctx) => {
  const exports = createExportsService(ctx);

  app.get('/exports', async () => ok({ resources: exports.resources() }));

  app.get('/exports/:resource', async (request, reply) => {
    const { resource } = parseOr400(ResourceParams, request.params);
    const { format } = parseOr400(FormatQuery, request.query);
    const pagination = parsePagination(request.query);

    const result = await exports.export({ resource, pagination });

    if (format === 'csv') {
      const csv = exports.toCsv(result.rows);
      return reply
        .header(
          'content-disposition',
          `attachment; filename="${result.resource}.csv"`,
        )
        .type('text/csv; charset=utf-8')
        .send(csv);
    }

    return ok(result);
  });
});
