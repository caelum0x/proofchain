"use client";

import { z } from "zod";
import { useApiList, type ApiListResult } from "./t5-useApiList";
import type { QueryParams } from "@/lib/api";

/**
 * Harvest records (WD §6 Markets → Harvests): producer, region, quantity, and
 * grade of a harvested lot, linkable to a provenance batch. Served by
 * `@proofchain/api` and validated at the boundary.
 */

export const harvestSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  commodity: z.string().optional(),
  producer: z.string().trim().optional(),
  region: z.string().optional(),
  quantity: z.union([z.string(), z.number()]).optional(),
  unit: z.string().optional(),
  grade: z.string().optional(),
  batch_id: z.string().optional(),
  status: z.string().optional(),
  harvested_at: z.union([z.string(), z.number()]).optional(),
});
export type Harvest = z.infer<typeof harvestSchema>;

export function useHarvests(params?: QueryParams): ApiListResult<Harvest> {
  return useApiList(harvestSchema, { key: "markets-harvests", path: "/harvests", params });
}
