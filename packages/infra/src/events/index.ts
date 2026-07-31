/**
 * Events (outbox) subsystem entrypoint.
 *
 * `createOutbox(client)` returns the Supabase-backed outbox when a live client
 * is supplied, and the in-memory outbox otherwise — no-op-safe by construction.
 * `drain` is the relay that publishes pending events at-least-once.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OutboxStore } from "./types.js";
import { createMemoryOutbox, createSupabaseOutbox, type OutboxDeps } from "./outbox.js";

export type { OutboxStore, OutboxEvent, OutboxAppend, OutboxStatus } from "./types.js";
export { OutboxEvent as OutboxEventSchema, OutboxAppend as OutboxAppendSchema } from "./types.js";
export {
  createMemoryOutbox,
  createSupabaseOutbox,
  drain,
  type OutboxDeps,
  type DrainResult,
} from "./outbox.js";

/** Select an outbox backend: Supabase when a client is provided, else memory. */
export function createOutbox(
  client: SupabaseClient | null = null,
  deps: OutboxDeps = {},
): OutboxStore {
  return client !== null
    ? createSupabaseOutbox(client, deps)
    : createMemoryOutbox(deps);
}
