/**
 * Service-layer convention — the ONE pattern every file in `src/services/`
 * follows.
 *
 * A service owns the READ/AGGREGATION logic for a single domain: it combines
 * on-chain reads (via `src/lib/chain.ts` + `@proofchain/shared`) with the
 * Supabase read-model (via `ctx.db`, which is backed by `@proofchain/infra`) and
 * returns typed DTOs — NEVER HTTP concerns. Routes stay thin: they parse/validate
 * input, call a service, and wrap the result in the `{ success, data, error }`
 * envelope (see `lib/route.ts` + `lib/envelope.ts`). This keeps aggregation logic
 * unit-testable in isolation (mocked chain + db, fully offline) and reusable
 * across routes, the indexer, exports, and reports.
 *
 * Fill-agent convention — to add a domain, ONLY add files:
 *   1. Create `src/services/<domain>.ts` exporting a factory built with
 *      {@link defineService}: `createXService(ctx) => ({ ...methods })`.
 *   2. (Optional) append one re-export line to `src/services/index.ts` for
 *      discoverability — routes may also import the service file directly.
 * Services return plain data / {@link ListResult}; the calling route wraps it.
 *
 * ```ts
 * // src/services/widgets.ts
 * import { defineService, pageRows, type ListResult } from './base.js';
 *
 * export interface WidgetDTO { readonly id: string; readonly owner: string }
 *
 * export const createWidgetsService = defineService((ctx) => ({
 *   async list(pagination): Promise<ListResult<WidgetDTO>> {
 *     return pageRows<WidgetDTO>(ctx.db, { table: 'widgets', pagination });
 *   },
 * }));
 * ```
 */
import type { AppContext } from '../context.js';
import type { Db, FilterValue } from '../lib/db.js';
import type { Pagination } from '../lib/pagination.js';

/** The dependency bundle a service receives — the same one routers get. */
export type ServiceContext = AppContext;

/**
 * A service factory: `(ctx) => service`. Built once per request-scoped context
 * (cheap — services are plain method bags with no own state). Use
 * {@link defineService} so the factory's parameter is typed without repeating
 * the annotation.
 */
export type ServiceFactory<TService> = (ctx: ServiceContext) => TService;

/**
 * Identity helper that pins the `ctx` parameter to {@link ServiceContext}. Gives
 * a service factory full inference on `ctx.chain` / `ctx.db` / `ctx.logger`
 * without an explicit annotation, mirroring `defineRoutes` for routers.
 */
export const defineService = <TService>(
  factory: ServiceFactory<TService>,
): ServiceFactory<TService> => factory;

/**
 * A paged read result: the window of `rows` plus the unpaged `total`. Services
 * return this for list/search; the route turns it into `okPage(rows, meta)`.
 */
export interface ListResult<T> {
  readonly rows: readonly T[];
  readonly total: number;
}

export interface PageRowsOptions {
  readonly table: string;
  readonly pagination: Pagination;
  readonly filters?: Readonly<Record<string, FilterValue>>;
  readonly order?: { readonly column: string; readonly ascending?: boolean };
}

/**
 * Page a read-model table into a {@link ListResult}: one filtered `list` for the
 * window and one `count` for the total, run concurrently. The db layer returns
 * empty/zero when Supabase is unconfigured, so this never throws offline.
 */
export const pageRows = async <T = Record<string, unknown>>(
  db: Db,
  { table, pagination, filters, order }: PageRowsOptions,
): Promise<ListResult<T>> => {
  const [rows, total] = await Promise.all([
    db.list<T>(table, {
      limit: pagination.limit,
      offset: pagination.offset,
      ...(filters !== undefined ? { filters } : {}),
      order: order ?? { column: 'created_at', ascending: false },
    }),
    db.count(table, filters),
  ]);
  return { rows, total };
};
