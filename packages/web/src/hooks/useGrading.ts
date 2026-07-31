"use client";

import { z } from "zod";
import { useApiList, type ApiListResult } from "./t5-useApiList";
import type { QueryParams } from "@/lib/api";

/**
 * Quality-grading assessments (WD §6 Markets → Grading): a grader's verdict on a
 * commodity lot / batch, with a letter grade and optional numeric score. Served
 * by `@proofchain/api`, validated at the boundary.
 */

export const gradingSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  batch_id: z.string().optional(),
  commodity: z.string().optional(),
  grader: z.string().trim().optional(),
  grade: z.string().optional(),
  score: z.union([z.string(), z.number()]).optional(),
  method: z.string().optional(),
  status: z.string().optional(),
  graded_at: z.union([z.string(), z.number()]).optional(),
});
export type Grading = z.infer<typeof gradingSchema>;

export function useGradings(params?: QueryParams): ApiListResult<Grading> {
  return useApiList(gradingSchema, { key: "markets-grading", path: "/grading", params });
}
