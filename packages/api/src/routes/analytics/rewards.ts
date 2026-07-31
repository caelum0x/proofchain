/**
 * /analytics/rewards — rewards domain drill-down.
 *
 * Autoloaded under `analytics/` (the `/analytics` prefix is applied
 * automatically). Thin wrapper over `AnalyticsService.rewards()`.
 */
import { ok } from '../../lib/envelope.js';
import { defineRoutes } from '../../lib/route.js';
import { createAnalyticsService } from '../../services/analytics.js';

export default defineRoutes((app, ctx) => {
  const analytics = createAnalyticsService(ctx);
  app.get('/rewards', async () => ok(await analytics.rewards()));
});
