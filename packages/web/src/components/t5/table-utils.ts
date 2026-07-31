import type { SortDir } from "@/hooks/t5-useListParams";

/**
 * Pure client-side filter → sort → paginate for on-chain (log-derived) lists,
 * where the data arrives as one array and the URL params drive the view. API
 * lists page/sort server-side instead, so they don't use this helper.
 */

export type Comparator<T> = (a: T, b: T) => number;

export interface TableStateInput<T> {
  readonly rows: readonly T[];
  /** Free-text query. */
  readonly q?: string;
  /** Accessor producing the searchable haystack for a row. */
  readonly search?: (row: T) => string;
  readonly sortId?: string | null;
  readonly sortDir?: SortDir;
  /** Column-id → comparator map for sortable columns. */
  readonly comparators?: Readonly<Record<string, Comparator<T>>>;
  readonly page: number;
  readonly limit: number;
}

export interface TableStateResult<T> {
  /** The rows for the current page after filtering + sorting. */
  readonly rows: readonly T[];
  /** Total matching rows across all pages. */
  readonly total: number;
}

/** Compare bigints for use in a {@link Comparator}. */
export function compareBigint(a: bigint, b: bigint): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function applyTableState<T>(input: TableStateInput<T>): TableStateResult<T> {
  const { rows, q, search, sortId, sortDir = "desc", comparators, page, limit } = input;

  let out: T[] = rows.slice();

  const term = q?.trim().toLowerCase();
  if (term && search) {
    out = out.filter((row) => search(row).toLowerCase().includes(term));
  }

  if (sortId && comparators && comparators[sortId]) {
    const cmp = comparators[sortId];
    out.sort((a, b) => (sortDir === "asc" ? cmp(a, b) : cmp(b, a)));
  }

  const total = out.length;
  const start = Math.max(0, page) * limit;
  return { rows: out.slice(start, start + limit), total };
}

/** Build a server-side `QueryParams` object from URL list state + extra facets. */
export function apiQuery(input: {
  readonly q: string;
  readonly sortId: string | null;
  readonly sortDir: SortDir;
  readonly page: number;
  readonly limit: number;
  readonly extra?: Readonly<Record<string, string | number | undefined>>;
}): Record<string, string | number | boolean | null | undefined> {
  const { q, sortId, sortDir, page, limit, extra } = input;
  return {
    q: q || undefined,
    sort: sortId || undefined,
    order: sortId ? sortDir : undefined,
    limit,
    offset: page * limit,
    ...(extra ?? {}),
  };
}

/** Convert a plain array of records into a CSV string for the export action. */
export function toCsv<T extends Record<string, unknown>>(
  rows: readonly T[],
  columns: readonly { readonly key: keyof T & string; readonly header: string }[],
): string {
  const escape = (value: unknown): string => {
    const s = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => escape(c.header)).join(",");
  const body = rows.map((row) => columns.map((c) => escape(row[c.key])).join(",")).join("\n");
  return `${head}\n${body}`;
}
