"use client";

import { z } from "zod";
import { useApiList, type ApiListResult } from "./t5-useApiList";
import type { QueryParams } from "@/lib/api";

/**
 * Data marketplace listings (WD §6 Markets → Data Market): datasets and feeds
 * published for sale/subscription (provenance telemetry, price oracles, ESG
 * series). Served by `@proofchain/api`, validated at the boundary.
 */

export const dataProductSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().optional(),
  provider: z.string().trim().optional(),
  category: z.string().optional(),
  access: z.string().optional(),
  price: z.union([z.string(), z.number()]).optional(),
  token: z.string().trim().optional(),
  records: z.union([z.string(), z.number()]).optional(),
  updated_at: z.union([z.string(), z.number()]).optional(),
});
export type DataProduct = z.infer<typeof dataProductSchema>;

export function useDataProducts(params?: QueryParams): ApiListResult<DataProduct> {
  return useApiList(dataProductSchema, { key: "markets-data", path: "/data-market", params });
}
