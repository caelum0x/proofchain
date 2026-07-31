"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiHealth, getNetworkStats, type ApiHealth, type NetworkStats } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

export interface AnalyticsView {
  /** Aggregate network stats from the backend analytics router (may be partial). */
  readonly stats: NetworkStats;
  /** Backend health/indexer status; `null` when the API is unreachable. */
  readonly health: ApiHealth | null;
  /** True while either query is in flight on first load. */
  readonly isLoading: boolean;
  /** Populated only when the API is unreachable — the page degrades to on-chain data. */
  readonly apiError: string | null;
  readonly refetch: () => void;
}

/**
 * Fetches dashboard analytics from the backend API. The API is optional: when it
 * is unreachable the queries resolve to empty/null with an `apiError`, letting
 * the dashboard fall back to live on-chain metrics rather than crashing.
 */
export function useAnalytics(): AnalyticsView {
  const statsQuery = useQuery<{ stats: NetworkStats; error: string | null }>({
    queryKey: ["analytics-overview"],
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      try {
        return { stats: await getNetworkStats(), error: null };
      } catch (error) {
        return { stats: {}, error: getErrorMessage(error) };
      }
    },
  });

  const healthQuery = useQuery<ApiHealth | null>({
    queryKey: ["analytics-health"],
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      try {
        return await getApiHealth();
      } catch {
        return null;
      }
    },
  });

  return {
    stats: statsQuery.data?.stats ?? {},
    health: healthQuery.data ?? null,
    isLoading: statsQuery.isLoading || healthQuery.isLoading,
    apiError: statsQuery.data?.error ?? null,
    refetch: () => {
      void statsQuery.refetch();
      void healthQuery.refetch();
    },
  };
}
