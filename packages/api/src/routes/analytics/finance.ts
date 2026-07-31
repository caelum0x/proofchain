/**
 * /analytics/finance — trade-finance domain drill-down.
 *
 * Autoloaded under the `analytics/` directory, so the `/analytics` prefix is
 * applied automatically (this file registers `/finance`). Thin wrapper over
 * `AnalyticsService.finance()`.
 */
import { ok } from '../../lib/envelope.js';
import { defineRoutes } from '../../lib/route.js';
import { createAnalyticsService } from '../../services/analytics.js';

export default defineRoutes((app, ctx) => {
  const analytics = createAnalyticsService(ctx);
  app.get('/finance', async () => ok(await analytics.finance()));
});
