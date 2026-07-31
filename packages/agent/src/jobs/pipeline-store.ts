/**
 * Generic pipeline job store. Mirrors the verification `JobStore` but is
 * parameterised over an arbitrary pipeline result so any flow (financing,
 * insurance, dpp, …) can persist its run for status queries via
 * `GET /pipelines/jobs/:id`. Ships in-memory behind an interface so a
 * Supabase-backed implementation can be dropped in later.
 */
import { randomUUID } from 'node:crypto';
import type { ErrorPayload } from '../errors.js';

export type PipelineJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface PipelineJob {
  readonly id: string;
  readonly pipelineId: string;
  readonly batchId: string;
  readonly status: PipelineJobStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly result?: unknown;
  readonly error?: ErrorPayload;
}

export interface PipelineJobStore {
  create(pipelineId: string, batchId: string): Promise<PipelineJob>;
  markRunning(id: string): Promise<void>;
  complete(id: string, result: unknown): Promise<void>;
  fail(id: string, error: ErrorPayload): Promise<void>;
  get(id: string): Promise<PipelineJob | null>;
}

export const createInMemoryPipelineJobStore = (): PipelineJobStore => {
  const jobs = new Map<string, PipelineJob>();

  const update = (id: string, patch: Partial<PipelineJob>): void => {
    const existing = jobs.get(id);
    if (existing === undefined) return;
    jobs.set(id, {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

  return {
    async create(pipelineId, batchId) {
      const now = new Date().toISOString();
      const job: PipelineJob = {
        id: randomUUID(),
        pipelineId,
        batchId,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      jobs.set(job.id, job);
      return job;
    },
    async markRunning(id) {
      update(id, { status: 'running' });
    },
    async complete(id, result) {
      update(id, { status: 'completed', result });
    },
    async fail(id, error) {
      update(id, { status: 'failed', error });
    },
    async get(id) {
      return jobs.get(id) ?? null;
    },
  };
};
