"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * URL-as-source-of-truth list state (WD §7) for the workforce + markets pages.
 *
 * Search, facet filters, sort, view mode, and pagination all live in
 * `searchParams`, so every list view is shareable and back/forward navigable.
 * Values are read from the URL and every mutator writes back via a shallow
 * `router.replace`, never mutating the current params object in place.
 */

export type SortDir = "asc" | "desc";
export type ViewMode = "table" | "grid";

export const DEFAULT_LIMIT = 10;

export interface ListParamsOptions {
  readonly defaultSort?: string;
  readonly defaultDir?: SortDir;
  readonly defaultView?: ViewMode;
  readonly limit?: number;
  /** Facet keys tracked in the URL (used to reset page on change). */
  readonly facets?: readonly string[];
}

export interface ListParams {
  /** Free-text search term (`q`). */
  readonly q: string;
  /** Active sort column id, or null when unsorted. */
  readonly sortId: string | null;
  readonly sortDir: SortDir;
  /** Zero-based page index. */
  readonly page: number;
  readonly limit: number;
  readonly view: ViewMode;
  /** Read a single facet value ("" when unset). */
  facet(key: string): string;
  /** Patch one or more params (empty/null values are removed). Resets page unless `page` is patched. */
  setParams(patch: Readonly<Record<string, string | number | null | undefined>>): void;
  setQ(value: string): void;
  setFacet(key: string, value: string | null): void;
  setPage(page: number): void;
  setView(view: ViewMode): void;
  /** Toggle sort on a column (asc → desc → asc), resetting to page 0. */
  toggleSort(id: string): void;
  /** True when any filter/search/sort is active. */
  readonly isFiltered: boolean;
  clearAll(): void;
}

export function useListParams(options: ListParamsOptions = {}): ListParams {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const limit = options.limit ?? DEFAULT_LIMIT;
  const defaultDir: SortDir = options.defaultDir ?? "desc";
  const defaultView: ViewMode = options.defaultView ?? "table";

  const q = searchParams.get("q") ?? "";
  const sortId = searchParams.get("sort") ?? options.defaultSort ?? null;
  const sortDir: SortDir = searchParams.get("dir") === "asc" ? "asc" : searchParams.get("dir") === "desc" ? "desc" : defaultDir;
  const pageRaw = Number(searchParams.get("page"));
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 0;
  const view: ViewMode = searchParams.get("view") === "grid" ? "grid" : searchParams.get("view") === "table" ? "table" : defaultView;

  const commit = useCallback(
    (patch: Readonly<Record<string, string | number | null | undefined>>, resetPage: boolean) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      if (resetPage && !("page" in patch)) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const facets = options.facets;

  return useMemo<ListParams>(() => {
    const facet = (key: string) => searchParams.get(key) ?? "";
    const isFiltered =
      q !== "" ||
      searchParams.get("sort") !== null ||
      (facets?.some((f) => searchParams.get(f)) ?? false);
    return {
      q,
      sortId,
      sortDir,
      page,
      limit,
      view,
      facet,
      setParams: (patch) => commit(patch, true),
      setQ: (value) => commit({ q: value }, true),
      setFacet: (key, value) => commit({ [key]: value }, true),
      setPage: (next) => commit({ page: next > 0 ? next : null }, false),
      setView: (next) => commit({ view: next === defaultView ? null : next }, false),
      toggleSort: (id) => {
        const nextDir: SortDir = sortId === id && sortDir === "asc" ? "desc" : "asc";
        commit({ sort: id, dir: nextDir }, true);
      },
      isFiltered,
      clearAll: () => router.replace(pathname, { scroll: false }),
    };
  }, [q, sortId, sortDir, page, limit, view, commit, searchParams, facets, defaultView, router, pathname]);
}
