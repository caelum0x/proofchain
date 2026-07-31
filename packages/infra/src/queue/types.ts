/**
 * Job queue interface + schemas.
 *
 * A minimal but real durable-job contract: enqueue work, atomically claim the
 * next runnable job, then mark it complete or failed (with bounded retries and
 * a dead-letter terminal state). Two backends implement it — an in-memory queue
 * (`memory.ts`) and a Supabase-backed queue (`supabase.ts`) over the
 * `queue_jobs` table. Both are exercised by offline tests.
 */
import { z } from "zod";
import { ErrorEnvelopeSchema } from "../types.js";
import type { Result } from "../errors.js";

export const QueueJobStatus = z.enum([
  "pending",
  "processing",
  "succeeded",
  "failed",
  "dead",
]);
export type QueueJobStatus = z.infer<typeof QueueJobStatus>;

/** A durable job row as stored/returned. */
export const QueueJob = z.object({
  id: z.string().min(1),
  queue: z.string().min(1),
  type: z.string().min(1),
  payload: z.record(z.unknown()),
  status: QueueJobStatus,
  attempts: z.number().int().min(0),
  maxAttempts: z.number().int().min(1),
  runAt: z.string(),
  lockedAt: z.string().nullable(),
  lastError: ErrorEnvelopeSchema.nullable(),
  result: z.record(z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type QueueJob = z.infer<typeof QueueJob>;

/** Fields accepted when enqueueing a job. */
export const EnqueueInput = z.object({
  type: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  queue: z.string().min(1).default("default"),
  /** ISO timestamp; the job is not runnable before this. Defaults to now. */
  runAt: z.string().optional(),
  maxAttempts: z.number().int().min(1).default(3),
});
/** Caller-facing input shape (schema defaults are optional on the way in). */
export type EnqueueInput = z.input<typeof EnqueueInput>;

/** Options controlling how a failed job is rescheduled. */
export interface FailOptions {
  /** Delay before the retry becomes runnable, in milliseconds (default 0). */
  readonly retryDelayMs?: number;
}

/** A pluggable durable job queue. All methods are non-throwing. */
export interface JobQueue {
  /** Stable backend identifier ("memory" | "supabase"). */
  readonly backend: string;
  /** Add a job to the queue. */
  enqueue(input: EnqueueInput): Promise<Result<QueueJob>>;
  /** Atomically claim the next runnable job for `queue`, or `null` if none. */
  dequeue(queue?: string): Promise<Result<QueueJob | null>>;
  /** Mark a claimed job succeeded, recording an optional result payload. */
  complete(id: string, result?: Record<string, unknown>): Promise<Result<QueueJob>>;
  /** Mark a claimed job failed: retried if attempts remain, else dead-lettered. */
  fail(
    id: string,
    error: { code: string; message: string; details?: Record<string, unknown> },
    options?: FailOptions,
  ): Promise<Result<QueueJob>>;
  /** Fetch a job by id, or `null`. */
  get(id: string): Promise<Result<QueueJob | null>>;
  /** Count jobs by status for `queue` (all queues when omitted). */
  stats(queue?: string): Promise<Result<Record<QueueJobStatus, number>>>;
}

/** Zero counts for every status — the starting point for `stats`. */
export function emptyStats(): Record<QueueJobStatus, number> {
  return { pending: 0, processing: 0, succeeded: 0, failed: 0, dead: 0 };
}
