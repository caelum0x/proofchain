/**
 * Route helper for the list/detail/search resource domains that delegate to a
 * {@link ResourceService} (trade-finance, compliance, dpp, …).
 *
 * A domain router stays a thin HTTP adapter: it declares a zod `filterSchema`
 * for its query params, then calls {@link registerResourceRoutes} to wire the
 * three standard endpoints — `GET /<path>` (list), `GET /<path>/search`
 * (filter + free-text), and `GET /<path>/:id` (detail or typed 404). All chain +
 * db aggregation lives in the service; this file only validates input (zod) and
 * wraps results in the `{ success, data, error }` envelope.
 *
 * This file lives in `src/lib/` (NOT `src/routes/`) so the autoloader never
 * treats it as a plugin — mirroring `resourceRoutes.ts`.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ResourceService } from '../services/support/resourceService.js';
import type { FilterValue } from './db.js';
import { ok, okPage } from './envelope.js';
import { notFound } from './errors.js';
import { pageMeta, parsePagination } from './pagination.js';
import { parseOr400 } from './reads.js';
import { compactFilters } from './resourceRoutes.js';

/** Config for a resource router: its base path, id validation, and filters. */
export interface ResourceRouteConfig {
  /** URL base, leading slash included (e.g. `/letters-of-credit`). */
  readonly path: string;
  /** Schema validating the `:id` path param (numeric id, address, bytes32). */
  readonly idSchema: z.ZodTypeAny;
  /** Human label used in the 404 message (e.g. `Letter of credit`). */
  readonly label: string;
  /**
   * Object schema validating the equality filter query params for list/search.
   * Unknown keys (pagination, `q`) are stripped by zod; `undefined` values are
   * dropped before reaching the db. Defaults to "no filters".
   */
  readonly filterSchema?: z.ZodObject<z.ZodRawShape>;
}

const EMPTY_FILTERS = z.object({});

/** Drop undefined entries and coerce the validated filter object to db filters. */
const toFilters = (parsed: Record<string, unknown>): Record<string, FilterValue> =>
  compactFilters(parsed as Record<string, FilterValue | undefined>);

/**
 * Register `GET /<path>`, `GET /<path>/search`, and `GET /<path>/:id` on `app`,
 * delegating to `service`. Handlers `return` an envelope; thrown `ApiError`s
 * (validation / not-found) are rendered by the central error handler.
 */
export const registerResourceRoutes = <T>(
  app: FastifyInstance,
  service: ResourceService<T>,
  config: ResourceRouteConfig,
): void => {
  const filterSchema = config.filterSchema ?? EMPTY_FILTERS;
  const searchSchema = filterSchema.extend({
    q: z.string().trim().min(1).optional(),
  });

  app.get(config.path, async (request) => {
    const parsed = parseOr400(filterSchema, request.query ?? {});
    const pagination = parsePagination(request.query);
    const filters = toFilters(parsed);
    const { rows, total } = await service.list({
      pagination,
      ...(Object.keys(filters).length > 0 ? { filters } : {}),
    });
    return okPage(rows, pageMeta(total, pagination));
  });

  app.get(`${config.path}/search`, async (request) => {
    const { q, ...rest } = parseOr400(searchSchema, request.query ?? {});
    const pagination = parsePagination(request.query);
    const filters = toFilters(rest as Record<string, unknown>);
    const { rows, total } = await service.search({
      pagination,
      ...(Object.keys(filters).length > 0 ? { filters } : {}),
      ...(typeof q === 'string' ? { q } : {}),
    });
    return okPage(rows, pageMeta(total, pagination));
  });

  app.get(`${config.path}/:id`, async (request) => {
    const { id } = request.params as { id: string };
    const validId = parseOr400(config.idSchema, id) as string;
    const row = await service.getById(validId);
    if (row === null) {
      throw notFound(`${config.label} ${validId} not found`);
    }
    return ok(row);
  });
};
