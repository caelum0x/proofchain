/**
 * /admin — operational status + non-secret configuration for operators.
 *
 * Thin HTTP surface over `AdminService`. Read-only and defensive: a chain RPC
 * failure degrades to `reachable:false` rather than erroring, and the config
 * projection is an explicit allowlist that NEVER echoes a secret.
 *   - GET /admin/status   → chain/db/indexer/contract status
 *   - GET /admin/config   → non-secret configuration
 *   - GET /admin/tables   → read-model row counts
 */
import { ok } from '../lib/envelope.js';
import { defineRoutes } from '../lib/route.js';
import { createAdminService } from '../services/admin.js';

export default defineRoutes((app, ctx) => {
  const admin = createAdminService(ctx);

  app.get('/admin/status', async () => ok(await admin.status()));

  app.get('/admin/config', async () => ok(admin.config()));

  app.get('/admin/tables', async () => ok(await admin.tables()));
});
