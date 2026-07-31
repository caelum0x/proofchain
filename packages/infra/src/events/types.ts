/**
 * Transactional outbox interface + schemas.
 *
 * The outbox pattern records domain events durably so a relay can publish them
 * at-least-once (to a queue, webhook, bus, …) without losing events on crash.
 * Two backends implement it — in-memory (`outbox.ts`) and Supabase-backed over
 * the `outbox_events` table. Both are non-throwing and offline-testable.
 */
import { z } from "zod";
import { ErrorEnvelopeSchema } from "../types.js";
import type { Result } from "../errors.js";

export const OutboxStatus = z.enum(["pending", "published", "failed"]);
export type OutboxStatus = z.infer<typeof OutboxStatus>;

/** A recorded outbox event as stored/returned. */
export const OutboxEvent = z.object({
  id: z.string().min(1),
  /** Aggregate/entity type the event belongs to (e.g. "deal"). */
  aggregate: z.string().min(1),
  /** Id of the specific aggregate instance. */
  aggregateId: z.string().min(1),
  /** Event type (e.g. "deal.funded"). */
  type: z.string().min(1),
  payload: z.record(z.unknown()),
  status: OutboxStatus,
  attempts: z.number().int().min(0),
  publishedAt: z.string().nullable(),
  lastError: ErrorEnvelopeSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type OutboxEvent = z.infer<typeof OutboxEvent>;

/** Fields accepted when appending an event. */
export const OutboxAppend = z.object({
  aggregate: z.string().min(1),
  aggregateId: z.string().min(1),
  type: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
});
/** Caller-facing input shape (the payload default is optional on the way in). */
export type OutboxAppend = z.input<typeof OutboxAppend>;

/** A durable transactional outbox. All methods are non-throwing. */
export interface OutboxStore {
  /** Stable backend identifier ("memory" | "supabase"). */
  readonly backend: string;
  /** Record a new event (status `pending`). */
  append(input: OutboxAppend): Promise<Result<OutboxEvent>>;
  /** Oldest-first pending events, capped by `limit` (default 100). */
  pending(limit?: number): Promise<Result<readonly OutboxEvent[]>>;
  /** Mark an event successfully published. */
  markPublished(id: string): Promise<Result<OutboxEvent>>;
  /** Mark an event failed (increments attempts, records the error). */
  markFailed(
    id: string,
    error: { code: string; message: string; details?: Record<string, unknown> },
  ): Promise<Result<OutboxEvent>>;
  /** Fetch an event by id, or `null`. */
  get(id: string): Promise<Result<OutboxEvent | null>>;
}
