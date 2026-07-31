"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * URL searchParams as the source of truth for list-page state (WD §7): filters,
 * sort, and pagination all live in the query string so every view is shareable
 * and back/forward navigable. Returns the current value for a key plus a setter
 * that patches the query string without a full navigation.
 */
export function useTradeUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const get = useCallback(
    (key: string, fallback = ""): string => searchParams.get(key) ?? fallback,
    [searchParams],
  );

  const setMany = useCallback(
    (patch: Readonly<Record<string, string | null | undefined>>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const set = useCallback(
    (key: string, value: string | null | undefined) => setMany({ [key]: value }),
    [setMany],
  );

  return useMemo(() => ({ get, set, setMany }), [get, set, setMany]);
}
