"use client";

import { useQuery } from "@tanstack/react-query";
import { getNetworkStats, type NetworkStats } from "@/lib/api";

/**
 * Fetch aggregate network stats from the ProofChain API for the landing page /
 * dashboards. Kept resilient: a single retry and a 60s stale window, and the
 * caller renders placeholders when `isError` (the API may be offline in dev).
 */
export function useNetworkStats() {
  const query = useQuery<NetworkStats>({
    queryKey: ["network-stats"],
    queryFn: () => getNetworkStats(),
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  return {
    stats: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
