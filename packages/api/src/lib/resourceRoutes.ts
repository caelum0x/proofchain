/**
 * Shared read-model helpers for the domain routers (invoices, financing, pools,
 * insurance, governance, …).
 *
 * These routers serve the EVENT-SOURCED read model that the indexer maintains in
 * Supabase: purpose-built projection tables (`receivables`, `policies`,
 * `proposals`, …) plus the append-only `indexer_events` audit log. The helpers
 * here centralize the three moves every router repeats — validate an untrusted
 * path/query value, page a table into a `{success,data,error,meta}` envelope, and
 * fetch a single row or 404 — so each router file stays small and focused.
 *
 * This file lives in `src/lib/` (NOT `src/routes/`) so the autoloader never
 * treats it as a plugin.
 */
import { z } from 'zod';
import type { Db, FilterValue } from './db.js';
import { okPage, ok, type ApiEnvelope, type PageMeta } from './envelope.js';
import { notFound, validationError } from './errors.js';
import { pageMeta, parsePagination, type Pagination } from './pagination.js';

/** A 20-byte hex address, normalized to lowercase for stable equality lookups. */
export const AddressSchema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'must be a 20-byte 0x-prefixed hex address')
  .transform((s) => s.toLowerCase());

/** A 32-byte hex value (batchId / verdictHash), normalized to lowercase. */
export const Bytes32Schema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{64}$/, 'must be a 32-byte 0x-prefixed hex value')
  .transform((s) => s.toLowerCase());

/** A non-negative integer id (tokenId, proposalId) accepted as a decimal string. */
export const NumericIdSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, 'must be a non-negative integer');

/** A free-form identifier (uuid, `key:key` composite, pool id). */
export const IdSchema = z.string().trim().min(1, 'must not be empty').max(128);

/**
 * Validate an untrusted value against a schema, throwing a typed
 * `VALIDATION_ERROR` (never a raw ZodError) with a client-safe issue list.
 */
export const parseOrThrow = <S extends z.ZodTypeAny>(
  schema: S,
  value: unknown,
  label: string,
): z.output<S> => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw validationError(`Invalid ${label}`, {
      issues: result.error.issues.map(
        (i) => `${i.path.join('.') || label}: ${i.message}`,
      ),
    });
  }
  return result.data;
};

/** Drop `undefined` entries so only explicit filters reach the query builder. */
export const compactFilters = (
  filters: Readonly<Record<string, FilterValue | undefined>>,
): Record<string, FilterValue> => {
  const out: Record<string, FilterValue> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
};

export interface ListTableOptions {
  readonly table: string;
  readonly pagination: Pagination;
  readonly filters?: Readonly<Record<string, FilterValue | undefined>>;
  readonly order?: { readonly column: string; readonly ascending?: boolean };
}

/**
 * Page a table into a list envelope: one filtered `list` for the window and one
 * `count` for the total, run concurrently. Rows are already JSON-safe (the
 * indexer stores bigints as strings), so no post-processing is needed.
 */
export const listTable = async <T = Record<string, unknown>>(
  db: Db,
  { table, pagination, filters, order }: ListTableOptions,
): Promise<ApiEnvelope<readonly T[]>> => {
  const compact = filters === undefined ? undefined : compactFilters(filters);
  const [rows, total] = await Promise.all([
    db.list<T>(table, {
      limit: pagination.limit,
      offset: pagination.offset,
      ...(compact !== undefined ? { filters: compact } : {}),
      order: order ?? { column: 'created_at', ascending: false },
    }),
    db.count(table, compact),
  ]);
  return okPage(rows, pageMeta(total, pagination));
};

/**
 * Fetch a single row by an equality match, returning an `ok` envelope, or throw
 * a typed `NOT_FOUND` so the central error handler renders the 404 envelope.
 */
export const getRowOr404 = async <T = Record<string, unknown>>(
  db: Db,
  table: string,
  column: string,
  value: FilterValue,
  label: string,
): Promise<ApiEnvelope<T>> => {
  const row = await db.getBy<T>(table, column, value);
  if (row === null) {
    throw notFound(`${label} not found`);
  }
  return ok(row);
};

/**
 * Fetch the most-recent row matching an equality filter (for lookups on a
 * NON-unique, indexed column where `getBy`'s single-row assertion would break).
 * Lists with `limit 1` newest-first and returns it, or throws `NOT_FOUND`.
 */
export const getLatestOr404 = async <T = Record<string, unknown>>(
  db: Db,
  table: string,
  column: string,
  value: FilterValue,
  label: string,
): Promise<ApiEnvelope<T>> => {
  const rows = await db.list<T>(table, {
    filters: { [column]: value },
    order: { column: 'created_at', ascending: false },
    limit: 1,
  });
  const row = rows[0];
  if (row === undefined) {
    throw notFound(`${label} not found`);
  }
  return ok(row);
};

export interface EventFeedOptions {
  /** Module group name from the indexer (`finance`, `settlement`, …). */
  readonly group?: string;
  /** Restrict to one contract (e.g. `PaymentRouter`). */
  readonly contract?: string;
  /** Restrict to one event name (e.g. `Routed`). */
  readonly eventName?: string;
  /** Extra equality filters (top-level columns or `args->>key` JSON paths). */
  readonly filters?: Readonly<Record<string, FilterValue | undefined>>;
  readonly pagination: Pagination;
}

/**
 * Page the append-only `indexer_events` audit log — the source of truth for
 * domains without a dedicated projection table (payments, treasury, nft,
 * referrals). Ordered newest-first by `created_at` (index-backed), which is
 * monotonic with ingestion and avoids lexical ordering of the numeric
 * `block_number` string.
 */
export const listEvents = async (
  db: Db,
  opts: EventFeedOptions,
): Promise<ApiEnvelope<readonly Record<string, unknown>[]>> =>
  listTable(db, {
    table: 'indexer_events',
    pagination: opts.pagination,
    filters: {
      group_name: opts.group,
      contract: opts.contract,
      event_name: opts.eventName,
      ...(opts.filters ?? {}),
    },
    order: { column: 'created_at', ascending: false },
  });

/** Parse `?limit=&offset=` defensively (never 400s a read). Re-exported for routers. */
export const paginate = (query: unknown): Pagination => parsePagination(query);

export type { Pagination, PageMeta };
