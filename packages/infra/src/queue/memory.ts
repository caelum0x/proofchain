/**
 * In-memory job queue — the always-available offline backend.
 *
 * A fully functional queue backed by a process-lifetime `Map`: durable jobs,
 * runnable-time scheduling, bounded retries and a dead-letter state. Ideal for
 * tests, local dev, and single-process deployments. The clock and id generator
 * are injectable for deterministic testing.
 */
import { randomUUID } from "node:crypto";
import { ok, err, InfraErrorCode, type Result } from "../errors.js";
import {
  EnqueueInput,
  QueueJob,
  emptyStats,
  type EnqueueInput as EnqueueInputT,
  type FailOptions,
  type JobQueue,
  type QueueJob as QueueJobT,
  type QueueJobStatus,
} from "./types.js";

export interface MemoryQueueDeps {
  readonly now?: () => number;
  readonly newId?: () => string;
}

/** Build an in-memory job queue over an isolated backing map. */
export function createMemoryJobQueue(deps: MemoryQueueDeps = {}): JobQueue {
  const jobs = new Map<string, QueueJobT>();
  const now = deps.now ?? Date.now;
  const newId = deps.newId ?? (() => randomUUID());

  const iso = (ms: number): string => new Date(ms).toISOString();

  return {
    backend: "memory",

    async enqueue(input: EnqueueInputT): Promise<Result<QueueJobT>> {
      const parsed = EnqueueInput.safeParse(input);
      if (!parsed.success) {
        return err(InfraErrorCode.VALIDATION, "Invalid enqueue input", {
          issues: parsed.error.issues,
        });
      }
      const ts = iso(now());
      const job: QueueJobT = {
        id: newId(),
        queue: parsed.data.queue,
        type: parsed.data.type,
        payload: parsed.data.payload,
        status: "pending",
        attempts: 0,
        maxAttempts: parsed.data.maxAttempts,
        runAt: parsed.data.runAt ?? ts,
        lockedAt: null,
        lastError: null,
        result: null,
        createdAt: ts,
        updatedAt: ts,
      };
      jobs.set(job.id, job);
      return ok(job);
    },

    async dequeue(queue = "default"): Promise<Result<QueueJobT | null>> {
      const nowMs = now();
      const runnable = [...jobs.values()]
        .filter(
          (j) =>
            j.queue === queue &&
            j.status === "pending" &&
            Date.parse(j.runAt) <= nowMs,
        )
        .sort((a, b) => Date.parse(a.runAt) - Date.parse(b.runAt));
      const next = runnable[0];
      if (next === undefined) return ok<QueueJobT | null>(null);
      const claimed: QueueJobT = {
        ...next,
        status: "processing",
        attempts: next.attempts + 1,
        lockedAt: iso(nowMs),
        updatedAt: iso(nowMs),
      };
      jobs.set(claimed.id, claimed);
      return ok<QueueJobT | null>(claimed);
    },

    async complete(
      id: string,
      result?: Record<string, unknown>,
    ): Promise<Result<QueueJobT>> {
      return transition(id, (job) => ({
        ...job,
        status: "succeeded",
        result: result ?? null,
        lockedAt: null,
        updatedAt: iso(now()),
      }));
    },

    async fail(
      id: string,
      error: { code: string; message: string; details?: Record<string, unknown> },
      options?: FailOptions,
    ): Promise<Result<QueueJobT>> {
      return transition(id, (job) => {
        const canRetry = job.attempts < job.maxAttempts;
        const delay = options?.retryDelayMs ?? 0;
        return {
          ...job,
          status: canRetry ? "pending" : "dead",
          lastError: {
            code: error.code,
            message: error.message,
            ...(error.details !== undefined ? { details: error.details } : {}),
          },
          runAt: canRetry ? iso(now() + delay) : job.runAt,
          lockedAt: null,
          updatedAt: iso(now()),
        };
      });
    },

    async get(id: string): Promise<Result<QueueJobT | null>> {
      return ok<QueueJobT | null>(jobs.get(id) ?? null);
    },

    async stats(queue?: string): Promise<Result<Record<QueueJobStatus, number>>> {
      const counts = emptyStats();
      for (const job of jobs.values()) {
        if (queue !== undefined && job.queue !== queue) continue;
        counts[job.status] += 1;
      }
      return ok(counts);
    },
  };

  function transition(
    id: string,
    fn: (job: QueueJobT) => QueueJobT,
  ): Result<QueueJobT> {
    const job = jobs.get(id);
    if (job === undefined) {
      return err(InfraErrorCode.VALIDATION, `Queue job not found: ${id}`);
    }
    const next = fn(job);
    const validated = QueueJob.safeParse(next);
    if (!validated.success) {
      return err(InfraErrorCode.VALIDATION, "Queue job became invalid", {
        issues: validated.error.issues,
      });
    }
    jobs.set(id, validated.data);
    return ok(validated.data);
  }
}
