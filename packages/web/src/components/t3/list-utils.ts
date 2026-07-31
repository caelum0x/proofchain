/**
 * Framework-free list helpers for the insurance + compliance section pages.
 *
 * List pages keep the URL as the source of truth for search/filter/sort/page
 * (WD §7) and derive the visible rows client-side from an indexed/API dataset.
 * These pure helpers do the filtering, sorting, pagination, and CSV export so
 * every page behaves identically. Side-effect free (except `downloadCsv`, which
 * is explicitly a browser side-effect) and easy to unit test.
 */

export type SortDir = "asc" | "desc";

/** Default page size for section list pages. */
export const PAGE_SIZE = 10;

/** Case-insensitive "contains" that treats an empty needle as "match all". */
export function textIncludes(haystack: string | undefined, needle: string): boolean {
  if (!needle) return true;
  return (haystack ?? "").toLowerCase().includes(needle.trim().toLowerCase());
}

/** A comparable key extracted from a row for sorting. */
export type SortKey = string | number | bigint | undefined;

/** Stable comparator honouring string/number/bigint and undefined ordering. */
export function compareBy<T>(a: T, b: T, key: (t: T) => SortKey, dir: SortDir): number {
  const av = key(a);
  const bv = key(b);
  let cmp: number;
  if (av === undefined && bv === undefined) cmp = 0;
  else if (av === undefined) cmp = -1;
  else if (bv === undefined) cmp = 1;
  else if (typeof av === "bigint" && typeof bv === "bigint") cmp = av < bv ? -1 : av > bv ? 1 : 0;
  else if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
  else cmp = String(av).localeCompare(String(bv));
  return dir === "asc" ? cmp : -cmp;
}

/**
 * Sort rows using a per-column key resolver. Unknown columns leave order intact
 * so callers never crash on a stale `sort` param in the URL.
 */
export function sortRows<T>(
  rows: readonly T[],
  keyFor: (id: string) => ((t: T) => SortKey) | undefined,
  sortId: string,
  dir: SortDir,
): readonly T[] {
  const key = sortId ? keyFor(sortId) : undefined;
  if (!key) return rows;
  return [...rows].sort((a, b) => compareBy(a, b, key, dir));
}

/** Slice a page out of the full row set. */
export function paginate<T>(rows: readonly T[], page: number, limit: number = PAGE_SIZE): readonly T[] {
  const start = Math.max(0, page) * Math.max(1, limit);
  return rows.slice(start, start + Math.max(1, limit));
}

/** Serialise a table to CSV, escaping quotes/commas/newlines. */
export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number)[])[],
): string {
  const esc = (v: string | number): string => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

/** Trigger a client-side CSV download. No-op during SSR. */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.click();
  URL.revokeObjectURL(url);
}
