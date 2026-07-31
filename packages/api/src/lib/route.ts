/**
 * Route helper convention — the ONE pattern every file in `src/routes/` follows.
 *
 * The autoloader (see `server.ts`) imports each `src/routes/*.ts` and registers
 * its DEFAULT export as a Fastify plugin. Writing plugins by hand is repetitive
 * and easy to get wrong (forgetting to read the context, mishandling errors), so
 * routers call `defineRoutes(...)` instead:
 *
 * ```ts
 * // src/routes/suppliers.ts
 * import { defineRoutes } from '../lib/route.js';
 * import { ok } from '../lib/envelope.js';
 *
 * export default defineRoutes(async (app, ctx) => {
 *   app.get('/suppliers', async (request) => {
 *     const rows = await ctx.db.list('suppliers', { limit: 25 });
 *     return ok(rows);
 *   });
 * });
 * ```
 *
 * `defineRoutes` gives the registrar the typed {@link AppContext} (already
 * decorated on the instance) and returns a `FastifyPluginAsync` the autoloader
 * can consume. Handlers just `return ok(data)` / `return okPage(rows, meta)`;
 * thrown `ApiError`s are converted to the `{ success, data, error }` envelope by
 * the central error handler, so route files never format errors themselves.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { AppContext } from '../context.js';

/** A router body: receives the Fastify instance (scoped) and the AppContext. */
export type RouteRegistrar = (
  app: FastifyInstance,
  ctx: AppContext,
) => void | Promise<void>;

/**
 * Wrap a {@link RouteRegistrar} into a `FastifyPluginAsync` for the autoloader.
 * The context is read from the decorated instance, so a router never imports
 * globals — everything it needs arrives as an argument.
 */
export const defineRoutes = (registrar: RouteRegistrar): FastifyPluginAsync => {
  const plugin: FastifyPluginAsync = async (app) => {
    await registrar(app, app.appContext);
  };
  return plugin;
};
