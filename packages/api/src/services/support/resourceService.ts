/**
 * Generic read-model resource service — the shared engine behind the many small
 * domain services in `src/services/` that need the SAME list / search / detail
 * shape over a single indexed projection table (letters-of-credit, guarantees,
 * passports, recalls, …).
 *
 * It follows the service convention in `../base.ts` exactly: it owns
 * READ/AGGREGATION logic (Supabase read model via `ctx.db`) and returns typed
 * DTOs / {@link ListResult} — never HTTP concerns. A domain service is then a
 * one-liner that pins the row type and the table/id/searchable columns:
 *
 * ```ts
 * // src/services/guarantees.ts
 * import { defineResourceService } from './support/resourceService.js';
 * export interface GuaranteeRow { readonly guarantee_id: string }
 * export const createGuaranteesService = defineResourceService<GuaranteeRow>({
 *   table: 'guarantees',
 *   idColumn: 'guarantee_id',
 *   searchColumns: ['beneficiary', 'obligor'],
 * });
 * ```
 *
 * `search` mirrors the canonical `SuppliersService.search`: it pages the table
 * (applying the same equality `filters` as `list`), then does an in-memory,
 * case-insensitive substring match over `searchColumns` for the free-text `q`.
 */
import type { FilterValue } from '../../lib/db.js';
import type { Pagination } from '../../lib/pagination.js';
import { defineService, pageRows, type ListResult, type ServiceFactory } from '../base.js';

/** Equality filters resolved by a route from validated query params. */
export type ResourceFilters = Readonly<Record<string, FilterValue>>;

export interface ResourceListQuery {
  readonly pagination: Pagination;
  readonly filters?: ResourceFilters;
}

export interface ResourceSearchQuery extends ResourceListQuery {
  /** Free-text needle matched against `searchColumns`. */
  readonly q?: string;
}

/** The uniform list/search/detail surface every resource domain exposes. */
export interface ResourceService<T> {
  /** Page the table, applying optional equality filters, newest-first. */
  list(query: ResourceListQuery): Promise<ListResult<T>>;
  /** Page + in-memory substring match over `searchColumns`. */
  search(query: ResourceSearchQuery): Promise<ListResult<T>>;
  /** Resolve one row by its id column, or null when unknown. */
  getById(id: string): Promise<T | null>;
}

export interface ResourceServiceConfig {
  /** Indexed projection table name (e.g. `letters_of_credit`). */
  readonly table: string;
  /** Primary lookup column for `getById` (e.g. `lc_id`, `address`, `token_id`). */
  readonly idColumn: string;
  /** Columns scanned by `search`'s free-text `q` (case-insensitive substring). */
  readonly searchColumns?: readonly string[];
  /** Order column for list/search; defaults to `created_at` (descending). */
  readonly orderColumn?: string;
}

const includesNeedle = (
  row: Record<string, unknown>,
  columns: readonly string[],
  needle: string,
): boolean =>
  columns.some((column) =>
    String(row[column] ?? '')
      .toLowerCase()
      .includes(needle),
  );

/**
 * Build a {@link ResourceService} for one table. Returns a
 * {@link ServiceFactory} so callers construct it with the request context
 * exactly like every other service (`createXService(ctx)`).
 */
export const defineResourceService = <T = Record<string, unknown>>(
  config: ResourceServiceConfig,
): ServiceFactory<ResourceService<T>> =>
  defineService<ResourceService<T>>((ctx) => {
    const order = {
      column: config.orderColumn ?? 'created_at',
      ascending: false,
    };
    const searchColumns = config.searchColumns ?? [];

    return {
      async list({ pagination, filters }): Promise<ListResult<T>> {
        return pageRows<T>(ctx.db, {
          table: config.table,
          pagination,
          ...(filters !== undefined ? { filters } : {}),
          order,
        });
      },

      async search({ pagination, filters, q }): Promise<ListResult<T>> {
        const rows = await ctx.db.list<T>(config.table, {
          limit: pagination.limit,
          offset: pagination.offset,
          ...(filters !== undefined ? { filters } : {}),
          order,
        });
        const needle = q?.trim().toLowerCase();
        const matched =
          needle === undefined || needle === '' || searchColumns.length === 0
            ? rows
            : rows.filter((row) =>
                includesNeedle(row as Record<string, unknown>, searchColumns, needle),
              );
        return { rows: matched, total: matched.length };
      },

      async getById(id): Promise<T | null> {
        return ctx.db.getBy<T>(config.table, config.idColumn, id);
      },
    };
  });
