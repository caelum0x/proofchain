/**
 * Outbox backends — in-memory and Supabase-backed — plus a `drain` relay.
 *
 * The in-memory store is the offline default; the Supabase store persists to the
 * `outbox_events` table. `drain` is the publisher loop: it reads pending events,
 * invokes a caller-supplied `publish` function, and marks each published or
 * failed. All operations return a `Result` and never throw.
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ok, err, InfraErrorCode, toEnvelope, type Result } from "../errors.js";
import {
  OutboxAppend,
  OutboxEvent,
  type OutboxAppend as OutboxAppendT,
  type OutboxEvent as OutboxEventT,
  type OutboxStore,
} from "./types.js";

const TABLE = "outbox_events";
const DEFAULT_LIMIT = 100;

export interface OutboxDeps {
  readonly now?: () => number;
  readonly newId?: () => string;
}

// -----------------------------------------------------------------------------
// in-memory backend
// -----------------------------------------------------------------------------

/** Build an in-memory outbox over an isolated backing map. */
export function createMemoryOutbox(deps: OutboxDeps = {}): OutboxStore {
  const events = new Map<string, OutboxEventT>();
  const now = deps.now ?? Date.now;
  const newId = deps.newId ?? (() => randomUUID());
  const iso = (ms: number): string => new Date(ms).toISOString();

  return {
    backend: "memory",

    async append(input: OutboxAppendT): Promise<Result<OutboxEventT>> {
      const parsed = OutboxAppend.safeParse(input);
      if (!parsed.success) {
        return err(InfraErrorCode.VALIDATION, "Invalid outbox event", {
          issues: parsed.error.issues,
        });
      }
      const ts = iso(now());
      const event: OutboxEventT = {
        id: newId(),
        aggregate: parsed.data.aggregate,
        aggregateId: parsed.data.aggregateId,
        type: parsed.data.type,
        payload: parsed.data.payload,
        status: "pending",
        attempts: 0,
        publishedAt: null,
        lastError: null,
        createdAt: ts,
        updatedAt: ts,
      };
      events.set(event.id, event);
      return ok(event);
    },

    async pending(limit = DEFAULT_LIMIT): Promise<Result<readonly OutboxEventT[]>> {
      const out = [...events.values()]
        .filter((e) => e.status === "pending")
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
        .slice(0, limit);
      return ok(out);
    },

    async markPublished(id: string): Promise<Result<OutboxEventT>> {
      return transition(id, (e) => ({
        ...e,
        status: "published",
        publishedAt: iso(now()),
        updatedAt: iso(now()),
      }));
    },

    async markFailed(
      id: string,
      error: { code: string; message: string; details?: Record<string, unknown> },
    ): Promise<Result<OutboxEventT>> {
      return transition(id, (e) => ({
        ...e,
        status: "failed",
        attempts: e.attempts + 1,
        lastError: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
        updatedAt: iso(now()),
      }));
    },

    async get(id: string): Promise<Result<OutboxEventT | null>> {
      return ok<OutboxEventT | null>(events.get(id) ?? null);
    },
  };

  function transition(
    id: string,
    fn: (e: OutboxEventT) => OutboxEventT,
  ): Result<OutboxEventT> {
    const event = events.get(id);
    if (event === undefined) {
      return err(InfraErrorCode.VALIDATION, `Outbox event not found: ${id}`);
    }
    const next = fn(event);
    const validated = OutboxEvent.safeParse(next);
    if (!validated.success) {
      return err(InfraErrorCode.VALIDATION, "Outbox event became invalid", {
        issues: validated.error.issues,
      });
    }
    events.set(id, validated.data);
    return ok(validated.data);
  }
}

// -----------------------------------------------------------------------------
// Supabase backend
// -----------------------------------------------------------------------------

/** Build a Supabase-backed outbox over a live client. */
export function createSupabaseOutbox(
  client: SupabaseClient,
  deps: OutboxDeps = {},
): OutboxStore {
  const now = deps.now ?? Date.now;
  const iso = (ms: number): string => new Date(ms).toISOString();

  return {
    backend: "supabase",

    async append(input: OutboxAppendT): Promise<Result<OutboxEventT>> {
      const parsed = OutboxAppend.safeParse(input);
      if (!parsed.success) {
        return err(InfraErrorCode.VALIDATION, "Invalid outbox event", {
          issues: parsed.error.issues,
        });
      }
      try {
        const { data, error } = await client
          .from(TABLE)
          .insert({
            aggregate: parsed.data.aggregate,
            aggregate_id: parsed.data.aggregateId,
            type: parsed.data.type,
            payload: parsed.data.payload,
            status: "pending",
            attempts: 0,
          })
          .select("*")
          .single();
        if (error) return err(InfraErrorCode.SUPABASE, error.message, { op: "append" });
        return validate(data);
      } catch (error) {
        return caught("append", error);
      }
    },

    async pending(limit = DEFAULT_LIMIT): Promise<Result<readonly OutboxEventT[]>> {
      try {
        const { data, error } = await client
          .from(TABLE)
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(limit);
        if (error) return err(InfraErrorCode.SUPABASE, error.message, { op: "pending" });
        const out: OutboxEventT[] = [];
        for (const row of (data ?? []) as Record<string, unknown>[]) {
          const parsed = OutboxEvent.safeParse(fromRow(row));
          if (!parsed.success) {
            return err(InfraErrorCode.VALIDATION, "Invalid outbox_events row", {
              issues: parsed.error.issues,
            });
          }
          out.push(parsed.data);
        }
        return ok(out);
      } catch (error) {
        return caught("pending", error);
      }
    },

    async markPublished(id: string): Promise<Result<OutboxEventT>> {
      return update(id, { status: "published", published_at: iso(now()) });
    },

    async markFailed(
      id: string,
      error: { code: string; message: string; details?: Record<string, unknown> },
    ): Promise<Result<OutboxEventT>> {
      const current = await this.get(id);
      if (!current.success) return current;
      if (current.data === null) {
        return err(InfraErrorCode.VALIDATION, `Outbox event not found: ${id}`);
      }
      return update(id, {
        status: "failed",
        attempts: current.data.attempts + 1,
        last_error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      });
    },

    async get(id: string): Promise<Result<OutboxEventT | null>> {
      try {
        const { data, error } = await client
          .from(TABLE)
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) return err(InfraErrorCode.SUPABASE, error.message, { op: "get" });
        if (data === null || data === undefined) return ok<OutboxEventT | null>(null);
        const parsed = OutboxEvent.safeParse(fromRow(data as Record<string, unknown>));
        if (!parsed.success) {
          return err(InfraErrorCode.VALIDATION, "Invalid outbox_events row", {
            issues: parsed.error.issues,
          });
        }
        return ok<OutboxEventT | null>(parsed.data);
      } catch (error) {
        return caught("get", error);
      }
    },
  };

  async function update(
    id: string,
    patch: Record<string, unknown>,
  ): Promise<Result<OutboxEventT>> {
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
// relay
// -----------------------------------------------------------------------------

export interface DrainResult {
  readonly published: number;
  readonly failed: number;
}

/**
 * Publish pending events at-least-once: read up to `limit` pending events, call
 * `publish` for each, and mark published/failed accordingly. Returns counts.
 * A `publish` that throws or rejects marks that event failed — never aborts the
 * batch.
 */
export async function drain(
  store: OutboxStore,
  publish: (event: OutboxEventT) => void | Promise<void>,
  limit = DEFAULT_LIMIT,
): Promise<Result<DrainResult>> {
  const pending = await store.pending(limit);
  if (!pending.success) return pending;

  let published = 0;
  let failed = 0;
  for (const event of pending.data) {
    try {
      await publish(event);
      const marked = await store.markPublished(event.id);
      if (marked.success) published += 1;
      else failed += 1;
    } catch (error) {
      const envelope = toEnvelope(error);
      await store.markFailed(event.id, {
        code: envelope.code,
        message: envelope.message,
        ...(envelope.details !== undefined ? { details: { ...envelope.details } } : {}),
      });
      failed += 1;
    }
  }
  return ok({ published, failed });
}

// -----------------------------------------------------------------------------
// row mapping helpers (Supabase)
// -----------------------------------------------------------------------------

function fromRow(row: Record<string, unknown>): unknown {
  return {
    id: row.id,
    aggregate: row.aggregate,
    aggregateId: row.aggregate_id,
    type: row.type,
    payload: row.payload ?? {},
    status: row.status,
    attempts: Number(row.attempts ?? 0),
    publishedAt: row.published_at ?? null,
    lastError: row.last_error ?? null,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  };
}

function validate(data: unknown): Result<OutboxEventT> {
  const parsed = OutboxEvent.safeParse(fromRow(data as Record<string, unknown>));
  if (!parsed.success) {
    return err(InfraErrorCode.VALIDATION, "Invalid outbox_events row", {
      issues: parsed.error.issues,
    });
  }
  return ok(parsed.data);
}

function caught<T>(op: string, error: unknown): Result<T> {
  return err<T>(InfraErrorCode.SUPABASE, `outbox ${op} failed`, {
    cause: toEnvelope(error),
  });
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
