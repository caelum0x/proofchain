/**
 * Supabase-backed job queue over the `queue_jobs` table.
 *
 * Implements the same `JobQueue` contract as the in-memory queue with durable
 * storage. Claiming is done with an optimistic conditional update
 * (`update ... where id = ? and status = 'pending'`) so two workers never claim
 * the same job. Every row crossing the boundary is zod-validated. All methods
 * return a `Result` and never throw.
 *
 * Tests mock `@supabase/supabase-js`, so this is fully offline-runnable.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ok, err, InfraErrorCode, toEnvelope, type Result } from "../errors.js";
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

const TABLE = "queue_jobs";

export interface SupabaseQueueDeps {
  readonly now?: () => number;
}

/** Build a Supabase-backed job queue over a live client. */
export function createSupabaseJobQueue(
  client: SupabaseClient,
  deps: SupabaseQueueDeps = {},
): JobQueue {
  const now = deps.now ?? Date.now;
  const iso = (ms: number): string => new Date(ms).toISOString();

  return {
    backend: "supabase",

    async enqueue(input: EnqueueInputT): Promise<Result<QueueJobT>> {
      const parsed = EnqueueInput.safeParse(input);
      if (!parsed.success) {
        return err(InfraErrorCode.VALIDATION, "Invalid enqueue input", {
          issues: parsed.error.issues,
        });
      }
      const row: Record<string, unknown> = {
        queue: parsed.data.queue,
        type: parsed.data.type,
        payload: parsed.data.payload,
        status: "pending",
        attempts: 0,
        max_attempts: parsed.data.maxAttempts,
        run_at: parsed.data.runAt ?? iso(now()),
      };
      try {
        const { data, error } = await client
          .from(TABLE)
          .insert(row)
          .select("*")
          .single();
        if (error) return err(InfraErrorCode.SUPABASE, error.message, { op: "enqueue" });
        return validate(data);
      } catch (error) {
        return caught("enqueue", error);
      }
    },

    async dequeue(queue = "default"): Promise<Result<QueueJobT | null>> {
      const nowMs = now();
      try {
        const { data: rows, error } = await client
          .from(TABLE)
          .select("*")
          .eq("queue", queue)
          .eq("status", "pending")
          .lte("run_at", iso(nowMs))
          .order("run_at", { ascending: true })
          .limit(1);
        if (error) return err(InfraErrorCode.SUPABASE, error.message, { op: "dequeue" });
        const candidate = (rows ?? [])[0] as Record<string, unknown> | undefined;
        if (candidate === undefined) return ok<QueueJobT | null>(null);

        const { data: claimed, error: claimErr } = await client
          .from(TABLE)
          .update({
            status: "processing",
            attempts: Number(candidate.attempts ?? 0) + 1,
            locked_at: iso(nowMs),
          })
          .eq("id", candidate.id as string)
          .eq("status", "pending")
          .select("*")
          .maybeSingle();
        if (claimErr) {
          return err(InfraErrorCode.SUPABASE, claimErr.message, { op: "claim" });
        }
        // Lost the race to another worker — nothing claimed this round.
        if (claimed === null || claimed === undefined) return ok<QueueJobT | null>(null);
        return validateNullable(claimed);
      } catch (error) {
        return caught("dequeue", error);
      }
    },

    async complete(
      id: string,
      result?: Record<string, unknown>,
    ): Promise<Result<QueueJobT>> {
      return updateById(id, {
        status: "succeeded",
        result: result ?? null,
        locked_at: null,
      });
    },

    async fail(
      id: string,
      error: { code: string; message: string; details?: Record<string, unknown> },
      options?: FailOptions,
    ): Promise<Result<QueueJobT>> {
      const current = await this.get(id);
      if (!current.success) return current;
      if (current.data === null) {
        return err(InfraErrorCode.VALIDATION, `Queue job not found: ${id}`);
      }
      const job = current.data;
      const canRetry = job.attempts < job.maxAttempts;
      const delay = options?.retryDelayMs ?? 0;
      return updateById(id, {
        status: canRetry ? "pending" : "dead",
        last_error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
        run_at: canRetry ? iso(now() + delay) : job.runAt,
        locked_at: null,
      });
    },

    async get(id: string): Promise<Result<QueueJobT | null>> {
      try {
        const { data, error } = await client
          .from(TABLE)
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) return err(InfraErrorCode.SUPABASE, error.message, { op: "get" });
        if (data === null || data === undefined) return ok<QueueJobT | null>(null);
        return validateNullable(data);
      } catch (error) {
        return caught("get", error);
      }
    },

    async stats(queue?: string): Promise<Result<Record<QueueJobStatus, number>>> {
      try {
        let query = client.from(TABLE).select("status");
        if (queue !== undefined) query = query.eq("queue", queue);
        const { data, error } = await query;
        if (error) return err(InfraErrorCode.SUPABASE, error.message, { op: "stats" });
        const counts = emptyStats();
        for (const row of (data ?? []) as Array<{ status?: string }>) {
          const status = row.status as QueueJobStatus | undefined;
          if (status !== undefined && status in counts) counts[status] += 1;
        }
        return ok(counts);
      } catch (error) {
        return caught("stats", error);
      }
    },
  };

  async function updateById(
    id: string,
    patch: Record<string, unknown>,
  ): Promise<Result<QueueJobT>> {
    try {
      const { data, error } = await client
        .from(TABLE)
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) return err(InfraErrorCode.SUPABASE, error.message, { op: "update" });
      return validate(data);
    } catch (error) {
      return caught("update", error);
    }
  }
}

// -----------------------------------------------------------------------------
// row mapping + validation
// -----------------------------------------------------------------------------

function fromRow(row: Record<string, unknown>): unknown {
  return {
    id: row.id,
    queue: row.queue,
    type: row.type,
    payload: row.payload ?? {},
    status: row.status,
    attempts: Number(row.attempts ?? 0),
    maxAttempts: Number(row.max_attempts ?? 1),
    runAt: normalizeTimestamp(row.run_at),
    lockedAt: row.locked_at ?? null,
    lastError: row.last_error ?? null,
    result: row.result ?? null,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  };
}

function validate(data: unknown): Result<QueueJobT> {
  const parsed = QueueJob.safeParse(fromRow(data as Record<string, unknown>));
  if (!parsed.success) {
    return err(InfraErrorCode.VALIDATION, "Invalid queue_jobs row", {
      issues: parsed.error.issues,
    });
  }
  return ok(parsed.data);
}

function validateNullable(data: unknown): Result<QueueJobT | null> {
  const parsed = QueueJob.safeParse(fromRow(data as Record<string, unknown>));
  if (!parsed.success) {
    return err(InfraErrorCode.VALIDATION, "Invalid queue_jobs row", {
      issues: parsed.error.issues,
    });
  }
  return ok<QueueJobT | null>(parsed.data);
}

function caught<T>(op: string, error: unknown): Result<T> {
  return err<T>(InfraErrorCode.SUPABASE, `queue ${op} failed`, {
    cause: toEnvelope(error),
  });
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
