"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * URL-as-source-of-truth list state for the logistics + sustainability section
 * (WD §7): search, sort, direction, and page live in `searchParams` so every
 * list view is shareable and back/forward navigable. Generic across resources —
 * callers read the typed values and push shallow URL updates.
 */
export interface T4ListState {
  readonly q: string;
  readonly sort: string | null;
  readonly dir: "asc" | "desc";
  readonly page: number;
  /** Read any extra param (e.g. a domain filter facet). */
  readonly get: (key: string) => string | null;
  /** Merge params into the URL; `null`/"" removes a key. Resets page unless told otherwise. */
  readonly setParams: (next: Readonly<Record<string, string | number | null>>, opts?: { keepPage?: boolean }) => void;
  readonly setPage: (page: number) => void;
  readonly setSort: (id: string) => void;
}

export function useT4ListState(defaults?: { sort?: string; dir?: "asc" | "desc" }): T4ListState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? defaults?.sort ?? null;
  const dir = (searchParams.get("dir") as "asc" | "desc" | null) ?? defaults?.dir ?? "desc";
  const page = clampInt(searchParams.get("page"), 0);

  const get = useCallback((key: string) => searchParams.get(key), [searchParams]);

  const setParams = useCallback(
    (next: Readonly<Record<string, string | number | null>>, opts?: { keepPage?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, String(value));
      }
      if (!opts?.keepPage && !("page" in next)) params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const setPage = useCallback((next: number) => setParams({ page: next <= 0 ? null : next }, { keepPage: true }), [setParams]);

  const setSort = useCallback(
    (id: string) => {
      const nextDir = sort === id && dir === "asc" ? "desc" : "asc";
      setParams({ sort: id, dir: nextDir });
    },
    [sort, dir, setParams],
  );

  return useMemo(
    () => ({ q, sort, dir, page, get, setParams, setPage, setSort }),
    [q, sort, dir, page, get, setParams, setPage, setSort],
  );
}

function clampInt(value: string | null, fallback: number): number {
  const n = value ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
