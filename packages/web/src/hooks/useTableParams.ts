"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SortState } from "@/components/ui/DataTable";
import type { ViewMode } from "@/components/page/Toolbar";

/**
 * URL-backed list state (WD §7): search / sort / pagination / view / arbitrary
 * facet filters live in `searchParams` so every list page is shareable and
 * reload-stable. Setters patch a single key and reset the page on filter change.
 */
export interface TableParams {
  readonly search: string;
  readonly sort: SortState | null;
  readonly page: number;
  readonly view: ViewMode;
  readonly get: (key: string) => string;
  readonly setSearch: (value: string) => void;
  readonly setSort: (sort: SortState) => void;
  readonly setPage: (page: number) => void;
  readonly setView: (view: ViewMode) => void;
  readonly setFilter: (key: string, value: string) => void;
  readonly reset: () => void;
}

export interface TableParamsOptions {
  readonly defaultView?: ViewMode;
  readonly defaultSort?: SortState | null;
}

export function useTableParams(options: TableParamsOptions = {}): TableParams {
  const { defaultView = "table", defaultSort = null } = options;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const commit = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const search = searchParams.get("q") ?? "";
  const view = (searchParams.get("view") as ViewMode | null) ?? defaultView;
  const pageRaw = Number(searchParams.get("page"));
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const sort = useMemo<SortState | null>(() => {
    const raw = searchParams.get("sort");
    if (!raw) return defaultSort;
    const [id, dir] = raw.split(":");
    if (!id) return defaultSort;
    return { id, dir: dir === "desc" ? "desc" : "asc" };
  }, [searchParams, defaultSort]);

  const get = useCallback((key: string) => searchParams.get(key) ?? "", [searchParams]);

  const setSearch = useCallback(
    (value: string) =>
      commit((p) => {
        if (value) p.set("q", value);
        else p.delete("q");
        p.delete("page");
      }),
    [commit],
  );

  const setSort = useCallback(
    (next: SortState) => commit((p) => p.set("sort", `${next.id}:${next.dir}`)),
    [commit],
  );

  const setPage = useCallback(
    (next: number) =>
      commit((p) => {
        if (next > 1) p.set("page", String(next));
        else p.delete("page");
      }),
    [commit],
  );

  const setView = useCallback(
    (next: ViewMode) => commit((p) => p.set("view", next)),
    [commit],
  );

  const setFilter = useCallback(
    (key: string, value: string) =>
      commit((p) => {
        if (value && value !== "all") p.set(key, value);
        else p.delete(key);
        p.delete("page");
      }),
    [commit],
  );

  const reset = useCallback(() => commit((p) => Array.from(p.keys()).forEach((k) => p.delete(k))), [
    commit,
  ]);

  return { search, sort, page, view, get, setSearch, setSort, setPage, setView, setFilter, reset };
}

/** Slice a fully-loaded, filtered list into the current page window. */
export function paginate<T>(rows: readonly T[], page: number, pageSize: number): readonly T[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}
