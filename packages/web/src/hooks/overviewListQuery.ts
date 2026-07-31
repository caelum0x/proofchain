"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * URL-as-source-of-truth list state (WD §7). Reads filters/sort/search/page from
 * `searchParams` and writes them back with `router.replace` so every list page is
 * shareable and back/forward-navigable. Generic across the section's list pages.
 */
export interface ListQuery {
  /** Read a param with a fallback. */
  readonly get: (key: string, fallback?: string) => string;
  /** Read a numeric param with a fallback. */
  readonly getNumber: (key: string, fallback: number) => number;
  /** Patch one or more params; empty/undefined values are removed. */
  readonly set: (updates: Readonly<Record<string, string | number | undefined>>) => void;
}

export function useListQuery(): ListQuery {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const get = useCallback(
    (key: string, fallback = "") => params.get(key) ?? fallback,
    [params],
  );

  const getNumber = useCallback(
    (key: string, fallback: number) => {
      const raw = params.get(key);
      if (raw === null) return fallback;
      const n = Number(raw);
      return Number.isFinite(n) ? n : fallback;
    },
    [params],
  );

  const set = useCallback(
    (updates: Readonly<Record<string, string | number | undefined>>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === "" || value === null) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return useMemo(() => ({ get, getNumber, set }), [get, getNumber, set]);
}
