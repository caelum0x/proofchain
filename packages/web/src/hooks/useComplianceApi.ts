"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import { apiList, type ApiList, type QueryParams } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { env } from "@/lib/env";

/**
 * A thin, typed wrapper over `apiList` for the compliance trade-doc surfaces
 * (certificates, customs, duties, export licenses, sanctions). Validates each
 * item against `itemSchema` at the boundary and exposes a consistent
 * loading/error/data shape the pages render with `AsyncBoundary`.
 *
 * The API is optional infrastructure: when the backend is unreachable the query
 * surfaces an error string and the page renders its ErrorState with a retry.
 */
export interface ComplianceListResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
}

export function useComplianceList<S extends z.ZodTypeAny>(
  key: string,
  path: string,
  itemSchema: S,
  params?: QueryParams,
): ComplianceListResult<z.infer<S>> {
  const query = useQuery<ApiList<z.infer<S>>>({
    queryKey: ["compliance", key, env.apiUrl, params ?? {}],
    queryFn: () => apiList(path, itemSchema, params),
    retry: 1,
    staleTime: 30_000,
  });

  const refetch = useCallback(() => void query.refetch(), [query]);

  return {
    items: query.data?.items ?? [],
    total: query.data?.meta.total ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.isError ? getErrorMessage(query.error) : null,
    refetch,
  };
}
