"use client";

import { z } from "zod";
import { useApiList, useApiResource, type ApiListResult } from "./t5-useApiList";
import type { QueryParams } from "@/lib/api";

/**
 * Workforce read models (WD §6 Workforce): worker credentials, safety training,
 * payroll runs, and verified skills. Data comes from the `@proofchain/api`
 * backend through the shared `lib/api.ts` transport; every response is validated
 * with zod at the boundary. Filters/sort/pagination flow through `params`.
 */

const Addressish = z.string().trim();

export const credentialSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  subject: Addressish.optional(),
  issuer: Addressish.optional(),
  credential_type: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  uri: z.string().optional(),
  issued_at: z.union([z.string(), z.number()]).optional(),
  expires_at: z.union([z.string(), z.number()]).optional(),
});
export type Credential = z.infer<typeof credentialSchema>;

export const safetyTrainingSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  worker: Addressish.optional(),
  course: z.string().optional(),
  provider: Addressish.optional(),
  score: z.union([z.string(), z.number()]).optional(),
  status: z.string().optional(),
  completed_at: z.union([z.string(), z.number()]).optional(),
  expires_at: z.union([z.string(), z.number()]).optional(),
});
export type SafetyTraining = z.infer<typeof safetyTrainingSchema>;

export const payrollRunSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  employer: Addressish.optional(),
  worker: Addressish.optional(),
  token: Addressish.optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  period: z.string().optional(),
  status: z.string().optional(),
  paid_at: z.union([z.string(), z.number()]).optional(),
});
export type PayrollRun = z.infer<typeof payrollRunSchema>;

export const skillSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  worker: Addressish.optional(),
  skill: z.string().optional(),
  level: z.string().optional(),
  endorsements: z.union([z.string(), z.number()]).optional(),
  verified_by: Addressish.optional(),
  attested_at: z.union([z.string(), z.number()]).optional(),
});
export type Skill = z.infer<typeof skillSchema>;

export function useSafetyTrainings(params?: QueryParams): ApiListResult<SafetyTraining> {
  return useApiList(safetyTrainingSchema, { key: "workforce-safety", path: "/safety-training", params });
}

export function usePayrollRuns(params?: QueryParams): ApiListResult<PayrollRun> {
  return useApiList(payrollRunSchema, { key: "workforce-payroll", path: "/payroll", params });
}

export function useSkills(params?: QueryParams): ApiListResult<Skill> {
  return useApiList(skillSchema, { key: "workforce-skills", path: "/skills", params });
}

export function useCredentials(address?: string, params?: QueryParams): ApiListResult<Credential> {
  return useApiList(credentialSchema, {
    key: "workforce-credentials",
    path: address ? `/credentials/${address}` : "/credentials",
    params,
    enabled: address === undefined || /^0x[0-9a-fA-F]{40}$/.test(address),
  });
}

const workerProfileSchema = z.object({
  address: Addressish.optional(),
  name: z.string().optional(),
  org: z.string().optional(),
  credentials: z.number().optional(),
  status: z.string().optional(),
});
export type WorkerProfile = z.infer<typeof workerProfileSchema>;

export function useWorkerProfile(address?: string) {
  return useApiResource(workerProfileSchema, {
    key: "workforce-worker",
    path: `/credentials/${address}/profile`,
    enabled: Boolean(address) && /^0x[0-9a-fA-F]{40}$/.test(address ?? ""),
  });
}
