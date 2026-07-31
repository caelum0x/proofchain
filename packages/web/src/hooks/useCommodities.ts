"use client";

import { z } from "zod";
import { useApiList, useApiResource, type ApiListResult } from "./t5-useApiList";
import type { QueryParams } from "@/lib/api";

/**
 * Commodities market data (WD §6 Markets). Reference prices, categories, and
 * per-symbol detail served by `@proofchain/api` through the shared transport,
 * validated with zod. Symbols key the detail route `/commodities/[symbol]`.
 */

export const commoditySchema = z.object({
  symbol: z.string(),
  name: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().optional(),
  reference_price: z.union([z.string(), z.number()]).optional(),
  change_24h: z.union([z.string(), z.number()]).optional(),
  volume_24h: z.union([z.string(), z.number()]).optional(),
  open_interest: z.union([z.string(), z.number()]).optional(),
  updated_at: z.union([z.string(), z.number()]).optional(),
});
export type Commodity = z.infer<typeof commoditySchema>;

const pricePointSchema = z.object({
  t: z.union([z.string(), z.number()]).optional(),
  price: z.union([z.string(), z.number()]),
});

export const commodityDetailSchema = commoditySchema.extend({
  description: z.string().optional(),
  high_24h: z.union([z.string(), z.number()]).optional(),
  low_24h: z.union([z.string(), z.number()]).optional(),
  history: z.array(pricePointSchema).optional(),
});
export type CommodityDetail = z.infer<typeof commodityDetailSchema>;

export function useCommodities(params?: QueryParams): ApiListResult<Commodity> {
  return useApiList(commoditySchema, { key: "markets-commodities", path: "/commodities", params });
}

export function useCommodity(symbol?: string) {
  return useApiResource(commodityDetailSchema, {
    key: "markets-commodity",
    path: `/commodities/${symbol}`,
    enabled: Boolean(symbol),
  });
}
