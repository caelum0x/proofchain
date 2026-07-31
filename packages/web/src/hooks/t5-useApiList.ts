"use client";

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet, type QueryParams } from "@/lib/api";
import { env } from "@/lib/env";
import { getErrorMessage } from "@/lib/errors";

/**
 * Domain list hook built on the `lib/api.ts` primitives (WD §7). The ProofChain
 * backend wraps lists as `{ success, data, meta:{ total, limit, offset } }`.
 * `apiGet` hands us the payload after the envelope layer, which — depending on
 * whether the envelope's `meta` matched — is either the bare array or the whole
 * `{ data, meta }` object. This module accepts every shape via a union schema so
 * the boundary stays strictly typed with no `any`.
 */

const metaSchema = z
  .object({
    total: z.number().int().nonnegative().optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
    page: z.number().int().nonnegative().optional(),
  })
  .partial();

export interface ApiListResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
}

/** Build the tolerant union schema for a list payload of `item`. */
function listSchema<S extends z.ZodTypeAny>(item: S) {
  return z.union([
    z.array(item),
    z.object({ items: z.array(item), meta: metaSchema.optional() }),
    z.object({ data: z.array(item), meta: metaSchema.optional() }),
  ]);
}

interface Normalised<T> {
  readonly items: readonly T[];
  readonly total: number;
}

type ListPayload<T> = readonly T[] | { items?: readonly T[]; data?: readonly T[]; meta?: z.infer<typeof metaSchema> };

function normalise<T>(payload: ListPayload<T>): Normalised<T> {
  if (Array.isArray(payload)) {
    const arr = payload as readonly T[];
    return { items: arr, total: arr.length };
  }
  const obj = payload as { items?: readonly T[]; data?: readonly T[]; meta?: z.infer<typeof metaSchema> };
  const items = obj.items ?? obj.data ?? [];
  return { items, total: obj.meta?.total ?? items.length };
}

export interface UseApiListOptions {
  /** react-query key namespace (domain). */
  readonly key: string;
  readonly path: string;
  readonly params?: QueryParams;
  /** Gate the request (e.g. wait for a required param). */
  readonly enabled?: boolean;
}

export function useApiList<S extends z.ZodTypeAny>(
  itemSchema: S,
  options: UseApiListOptions,
): ApiListResult<z.infer<S>> {
  type Item = z.infer<S>;
  const { key, path, params, enabled = true } = options;
  const schema = useMemo(() => listSchema(itemSchema), [itemSchema]);

  const query = useQuery<Normalised<Item>>({
    queryKey: [key, env.chainId, path, params ?? {}],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const payload = await apiGet(path, schema, params);
      return normalise<Item>(payload as never);
    },
  });

  return {
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading && enabled,
    isFetching: query.isFetching,
    error: query.isError ? getErrorMessage(query.error) : null,
    refetch: () => void query.refetch(),
  };
}

/** Single-resource fetch on the same envelope-tolerant transport. */
export function useApiResource<S extends z.ZodTypeAny>(
  itemSchema: S,
  options: UseApiListOptions,
): {
  readonly data: z.infer<S> | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
} {
  type Item = z.infer<S>;
  const { key, path, params, enabled = true } = options;
  const query = useQuery<Item>({
    queryKey: [key, env.chainId, path, params ?? {}],
    enabled,
    queryFn: async () => apiGet(path, itemSchema, params) as Promise<Item>,
  });
  return {
    data: query.data ?? null,
    isLoading: query.isLoading && enabled,
    error: query.isError ? getErrorMessage(query.error) : null,
    refetch: () => void query.refetch(),
  };
}
