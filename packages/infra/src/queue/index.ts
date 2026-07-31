/**
 * Queue subsystem entrypoint.
 *
 * `createJobQueue(client)` returns the Supabase-backed queue when a live client
 * is supplied, and the in-memory queue otherwise — so callers get a working
 * queue with or without a configured database (no-op-safe by construction).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobQueue } from "./types.js";
import { createMemoryJobQueue } from "./memory.js";
import { createSupabaseJobQueue } from "./supabase.js";

export type {
  JobQueue,
  QueueJob,
  QueueJobStatus,
  EnqueueInput,
  FailOptions,
} from "./types.js";
export { QueueJob as QueueJobSchema, EnqueueInput as EnqueueInputSchema, emptyStats } from "./types.js";
export { createMemoryJobQueue, type MemoryQueueDeps } from "./memory.js";
export { createSupabaseJobQueue, type SupabaseQueueDeps } from "./supabase.js";

export interface JobQueueDeps {
  readonly now?: () => number;
  readonly newId?: () => string;
}

/**
 * Select a queue backend: Supabase when a client is provided, otherwise the
 * in-memory fallback.
 */
export function createJobQueue(
  client: SupabaseClient | null = null,
  deps: JobQueueDeps = {},
): JobQueue {
  if (client !== null) {
    return createSupabaseJobQueue(client, deps.now !== undefined ? { now: deps.now } : {});
  }
  return createMemoryJobQueue(deps);
}
