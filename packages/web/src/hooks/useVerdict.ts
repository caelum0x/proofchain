"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchVerdictJson, type Verdict } from "@/lib/verdict";

/** Fetch and cache a verdict JSON document from its verdictURI. */
export function useVerdict(verdictURI: string | undefined, enabled = true) {
  const query = useQuery<Verdict>({
    queryKey: ["verdict", verdictURI],
    enabled: Boolean(verdictURI) && enabled,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async ({ signal }) => {
      if (!verdictURI) throw new Error("No verdict URI");
      return fetchVerdictJson(verdictURI, signal);
    },
  });

  return {
    verdict: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
