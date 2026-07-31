"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SortDir } from "@/components/t3/list-utils";

/**
 * The URL-backed state for a section list page: free-text search, a status
 * facet, a sort column + direction, and a zero-based page index. Keeping this
 * in `searchParams` makes every list view shareable and back/forward safe
 * (WD §7).
 */
export interface ListParamsState {
  readonly q: string;
  readonly status: string;
  readonly sort: string;
  readonly dir: SortDir;
  readonly page: number;
}

export interface ListParamsConfig {
  readonly defaultSort?: string;
  readonly defaultDir?: SortDir;
  readonly defaultStatus?: string;
}

export interface ListParamsApi {
  readonly state: ListParamsState;
  /** Set the search text (resets to page 0). */
  readonly setQuery: (q: string) => void;
  /** Set the status facet (resets to page 0). */
  readonly setStatus: (status: string) => void;
  /** Set the sort column + direction (keeps page). */
  readonly setSort: (sort: { id: string; dir: SortDir }) => void;
  /** Navigate to a page. */
  readonly setPage: (page: number) => void;
  /** Clear all filters back to defaults. */
  readonly reset: () => void;
}

/**
 * Reads and writes the list-page query string. Reads are memoised from
 * `useSearchParams`; writes use `router.replace` (no scroll, no history spam)
 * so filter tweaks feel instant and stay in the URL.
 */
export function useT3ListParams(config: ListParamsConfig = {}): ListParamsApi {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { defaultSort = "", defaultDir = "desc", defaultStatus = "all" } = config;

  const state: ListParamsState = useMemo(() => {
    const rawDir = searchParams.get("dir");
    const rawPage = Number(searchParams.get("page") ?? "0");
    return {
      q: searchParams.get("q") ?? "",
      status: searchParams.get("status") ?? defaultStatus,
      sort: searchParams.get("sort") ?? defaultSort,
      dir: rawDir === "asc" ? "asc" : rawDir === "desc" ? "desc" : defaultDir,
      page: Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 0,
    };
  }, [searchParams, defaultSort, defaultDir, defaultStatus]);

  const commit = useCallback(
    (patch: Record<string, string | number | undefined>, resetPage: boolean) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "" || value === "all") next.delete(key);
        else next.set(key, String(value));
      }
      if (resetPage) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const setQuery = useCallback((q: string) => commit({ q }, true), [commit]);
  const setStatus = useCallback((status: string) => commit({ status }, true), [commit]);
  const setSort = useCallback(
    (sort: { id: string; dir: SortDir }) => commit({ sort: sort.id, dir: sort.dir }, false),
    [commit],
  );
  const setPage = useCallback((page: number) => commit({ page: page > 0 ? page : undefined }, false), [commit]);
  const reset = useCallback(
    () => router.replace(pathname, { scroll: false }),
    [router, pathname],
  );

  return { state, setQuery, setStatus, setSort, setPage, reset };
}
