/**
 * Generic, typed database layer over Supabase (PostgREST).
 *
 * The API reads/writes MANY domain tables (suppliers, deals, financing, …) that
 * the purpose-built `@proofchain/infra` store does not model individually. Rather
 * than hand-write a repository per table here, we expose a small generic query
 * surface (`list`/`getBy`/`count`/`upsert`/`insert`) that routers and the indexer
 * compose. Infra still owns connection + credentials: we borrow its underlying
 * client via `store.raw()`, so there is ONE place that reads `SUPABASE_*`.
 *
 * Graceful degradation (first-class): when Supabase is unconfigured the client
 * is null and reads resolve to empty results while writes throw a typed
 * DB_NOT_CONFIGURED error — never a crash, never a silent success.
 */
import { createSupabaseStore } from '@proofchain/infra';
import type { ApiConfig } from '../config/env.js';
import type { Logger } from '../logger.js';
import { ApiError, dbError, errorMessage } from './errors.js';
import { MAX_PAGE_LIMIT } from '../config/constants.js';

/** A filter value comparable with PostgREST `.eq()`. */
export type FilterValue = string | number | boolean | null;

export interface ListOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly order?: { readonly column: string; readonly ascending?: boolean };
  readonly filters?: Readonly<Record<string, FilterValue>>;
  /** Column selection; defaults to `*`. */
  readonly select?: string;
}

export interface Db {
  readonly isConfigured: boolean;
  /** List rows with optional filters/order/pagination. Empty when unconfigured. */
  list<T = Record<string, unknown>>(
    table: string,
    options?: ListOptions,
  ): Promise<T[]>;
  /** Total row count for a filtered set (head request). Zero when unconfigured. */
  count(table: string, filters?: Readonly<Record<string, FilterValue>>): Promise<number>;
  /** Fetch a single row by an equality match, or null. Null when unconfigured. */
  getBy<T = Record<string, unknown>>(
    table: string,
    column: string,
    value: FilterValue,
    select?: string,
  ): Promise<T | null>;
  /** Upsert a row on a conflict target, returning the stored row. */
  upsert<T = Record<string, unknown>>(
    table: string,
    row: Record<string, unknown>,
    onConflict: string,
  ): Promise<T>;
  /** Insert a row, returning the stored row. */
  insert<T = Record<string, unknown>>(
    table: string,
    row: Record<string, unknown>,
  ): Promise<T>;
}

const NOT_CONFIGURED_MSG =
  'Supabase is not configured (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY); write skipped.';

/** Minimal shape of the PostgREST query builder we rely on (keeps us driver-light). */
type QueryBuilder = {
  select: (columns?: string, opts?: { count?: 'exact'; head?: boolean }) => QueryBuilder;
  insert: (row: Record<string, unknown>) => QueryBuilder;
  upsert: (row: Record<string, unknown>, opts: { onConflict: string }) => QueryBuilder;
  eq: (column: string, value: FilterValue) => QueryBuilder;
  order: (column: string, opts: { ascending: boolean }) => QueryBuilder;
  range: (from: number, to: number) => QueryBuilder;
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
  single: () => Promise<{ data: unknown; error: { message: string } | null }>;
  then: Promise<{ data: unknown; error: { message: string } | null; count: number | null }>['then'];
};

type RawClient = { from: (table: string) => QueryBuilder } | null;

const clampLimit = (limit?: number): number => {
  if (limit === undefined) return MAX_PAGE_LIMIT;
  if (!Number.isFinite(limit) || limit <= 0) return 1;
  return Math.min(Math.floor(limit), MAX_PAGE_LIMIT);
};

const applyFilters = (
  query: QueryBuilder,
  filters?: Readonly<Record<string, FilterValue>>,
): QueryBuilder => {
  if (filters === undefined) return query;
  let q = query;
  for (const [column, value] of Object.entries(filters)) {
    q = q.eq(column, value);
  }
  return q;
};

/**
 * Build the DB layer. The infra store is created once (it lazily imports the
 * Supabase driver only when configured), and we reuse its raw client.
 */
export const createDb = async (config: ApiConfig, logger: Logger): Promise<Db> => {
  const store = await createSupabaseStore({
    supabase:
      config.SUPABASE_URL !== undefined && config.SUPABASE_SERVICE_ROLE_KEY !== undefined
        ? {
            configured: true,
            url: config.SUPABASE_URL,
            serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
          }
        : { configured: false },
    ipfs: {
      configured: false,
      apiUrl: 'https://api.pinata.cloud',
      gatewayUrl: 'https://gateway.pinata.cloud/ipfs',
    },
  });

  const raw = store.raw() as RawClient;

  if (raw === null) {
    logger.warn('db: Supabase not configured — reads return empty, writes are rejected');
    return createNoopDb();
  }

  const requireOk = <T>(
    result: { data: unknown; error: { message: string } | null },
    context: string,
  ): T => {
    if (result.error !== null) {
      throw dbError(`${context} failed`, { cause: result.error.message });
    }
    return result.data as T;
  };

  return {
    isConfigured: true,

    async list<T = Record<string, unknown>>(
      table: string,
      options: ListOptions = {},
    ): Promise<T[]> {
      try {
        const limit = clampLimit(options.limit);
        const offset = Math.max(0, Math.floor(options.offset ?? 0));
        let query = applyFilters(
          raw.from(table).select(options.select ?? '*'),
          options.filters,
        );
        if (options.order !== undefined) {
          query = query.order(options.order.column, {
            ascending: options.order.ascending ?? true,
          });
        }
        query = query.range(offset, offset + limit - 1);
        const result = await (query as unknown as Promise<{
          data: unknown;
          error: { message: string } | null;
        }>);
        return (requireOk<T[] | null>(result, `list ${table}`) ?? []) as T[];
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw dbError(`list ${table} failed`, { cause: errorMessage(err) });
      }
    },

    async count(
      table: string,
      filters?: Readonly<Record<string, FilterValue>>,
    ): Promise<number> {
      try {
        const query = applyFilters(
          raw.from(table).select('*', { count: 'exact', head: true }),
          filters,
        );
        const result = await (query as unknown as Promise<{
          error: { message: string } | null;
          count: number | null;
        }>);
        if (result.error !== null) {
          throw dbError(`count ${table} failed`, { cause: result.error.message });
        }
        return result.count ?? 0;
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw dbError(`count ${table} failed`, { cause: errorMessage(err) });
      }
    },

    async getBy<T = Record<string, unknown>>(
      table: string,
      column: string,
      value: FilterValue,
      select = '*',
    ): Promise<T | null> {
      try {
        const result = await raw
          .from(table)
          .select(select)
          .eq(column, value)
          .maybeSingle();
        return requireOk<T | null>(result, `getBy ${table}.${column}`);
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw dbError(`getBy ${table} failed`, { cause: errorMessage(err) });
      }
    },

    async upsert<T = Record<string, unknown>>(
      table: string,
      row: Record<string, unknown>,
      onConflict: string,
    ): Promise<T> {
      try {
        const result = await raw
          .from(table)
          .upsert(row, { onConflict })
          .select('*')
          .single();
        return requireOk<T>(result, `upsert ${table}`);
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw dbError(`upsert ${table} failed`, { cause: errorMessage(err) });
      }
    },

    async insert<T = Record<string, unknown>>(
      table: string,
      row: Record<string, unknown>,
    ): Promise<T> {
      try {
        const result = await raw.from(table).insert(row).select('*').single();
        return requireOk<T>(result, `insert ${table}`);
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw dbError(`insert ${table} failed`, { cause: errorMessage(err) });
      }
    },
  };
};

/** No-op DB used when Supabase is unconfigured. Reads empty, writes rejected. */
const createNoopDb = (): Db => ({
  isConfigured: false,
  async list() {
    return [];
  },
  async count() {
    return 0;
  },
  async getBy() {
    return null;
  },
  async upsert() {
    throw new ApiError('DB_NOT_CONFIGURED', NOT_CONFIGURED_MSG);
  },
  async insert() {
    throw new ApiError('DB_NOT_CONFIGURED', NOT_CONFIGURED_MSG);
  },
});
