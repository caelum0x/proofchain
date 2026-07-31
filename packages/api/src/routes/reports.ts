/**
 * /reports — named, dashboard-ready aggregate reports.
 *
 * Thin HTTP surface over `ReportsService`: a whole-platform summary plus
 * per-domain breakdowns the web app and exporters render directly.
 *   - GET /reports            → available report domains
 *   - GET /reports/summary    → whole-platform overview
 *   - GET /reports/:domain    → per-domain report
 */
import { z } from 'zod';
import { ok } from '../lib/envelope.js';
import { parseOr400 } from '../lib/reads.js';
import { defineRoutes } from '../lib/route.js';
import { createReportsService } from '../services/reports.js';

const DomainParams = z.object({ domain: z.string().trim().min(1) });

export default defineRoutes((app, ctx) => {
  const reports = createReportsService(ctx);

  app.get('/reports', async () => ok({ domains: reports.domains() }));

  app.get('/reports/summary', async () => ok(await reports.summary()));

  app.get('/reports/:domain', async (request) => {
    const { domain } = parseOr400(DomainParams, request.params);
    return ok(await reports.domain(domain));
  });
});
