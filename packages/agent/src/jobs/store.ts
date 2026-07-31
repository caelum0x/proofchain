/**
 * Job store abstraction. Verification jobs are persisted so `GET /jobs/:id` can
 * report status. The SPEC allows a Supabase-backed store with an in-memory
 * fallback; since infra is a separate package, we ship the in-memory store here
 * behind an interface so a DB-backed implementation can be dropped in later.
 */
import { randomUUID } from 'node:crypto';
import type { ErrorPayload } from '../errors.js';
import type { VerifyResult } from '../verifier.js';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Job {
  id: string;
  batchId: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  result?: VerifyResult;
  error?: ErrorPayload;
}

export interface JobStore {
  create(batchId: string): Promise<Job>;
  markRunning(id: string): Promise<void>;
  complete(id: string, result: VerifyResult): Promise<void>;
  fail(id: string, error: ErrorPayload): Promise<void>;
  get(id: string): Promise<Job | null>;
}

export const createInMemoryJobStore = (): JobStore => {
  const jobs = new Map<string, Job>();

  const update = (id: string, patch: Partial<Job>): void => {
    const existing = jobs.get(id);
    if (existing === undefined) return;
    jobs.set(id, { ...existing, ...patch, updatedAt: new Date().toISOString() });
  };

  return {
    async create(batchId: string): Promise<Job> {
      const now = new Date().toISOString();
      const job: Job = {
        id: randomUUID(),
        batchId,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      jobs.set(job.id, job);
      return job;
    },
    async markRunning(id: string): Promise<void> {
      update(id, { status: 'running' });
    },
    async complete(id: string, result: VerifyResult): Promise<void> {
      update(id, { status: 'completed', result });
    },
    async fail(id: string, error: ErrorPayload): Promise<void> {
      update(id, { status: 'failed', error });
    },
    async get(id: string): Promise<Job | null> {
      return jobs.get(id) ?? null;
    },
  };
};
