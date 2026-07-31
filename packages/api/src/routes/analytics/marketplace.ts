/**
 * /analytics/marketplace — marketplace domain drill-down.
 *
 * Autoloaded under `analytics/` (the `/analytics` prefix is applied
 * automatically). Thin wrapper over `AnalyticsService.marketplace()`.
 */
import { ok } from '../../lib/envelope.js';
import { defineRoutes } from '../../lib/route.js';
import { createAnalyticsService } from '../../services/analytics.js';

export default defineRoutes((app, ctx) => {
  const analytics = createAnalyticsService(ctx);
  app.get('/marketplace', async () => ok(await analytics.marketplace()));
});
