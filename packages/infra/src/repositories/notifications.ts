/**
 * Notifications repository — typed data access for the `notifications` app-level
 * table. Rows are append-only (uuid pk, no `updated_at`); the `read` flag is the
 * only mutable column. See `deals.ts` for the fill convention; never hand-edit
 * `index.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AddressHex } from "../types.js";
import type { Result } from "../errors.js";
import { BaseRepository, type RepositoryConfig } from "./base.js";

/** Fields accepted when creating a notification (id/read/timestamps default). */
export const NotificationInput = z.object({
  id: z.string().uuid().optional(),
  recipient: AddressHex.nullable().optional(),
  kind: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  read: z.boolean().optional(),
});
export type NotificationInput = z.infer<typeof NotificationInput>;

/** A notification row as stored/returned. */
export const Notification = z.object({
  id: z.string().uuid(),
  recipient: AddressHex.nullable(),
  kind: z.string(),
  payload: z.record(z.unknown()),
  read: z.boolean(),
  createdAt: z.string(),
});
export type Notification = z.infer<typeof Notification>;

const config: RepositoryConfig<Notification, NotificationInput> = {
  table: "notifications",
  primaryKey: "id",
  entitySchema: Notification,
  insertSchema: NotificationInput,
  toRow: (n) => ({
    ...(n.id !== undefined ? { id: n.id } : {}),
    recipient: n.recipient ?? null,
    kind: n.kind,
    payload: n.payload ?? {},
    read: n.read ?? false,
  }),
  fromRow: (row) => ({
    id: row.id,
    recipient: row.recipient ?? null,
    kind: row.kind,
    payload: row.payload ?? {},
    read: row.read ?? false,
    createdAt: normalizeTimestamp(row.created_at),
  }),
};

/** Typed data access for the `notifications` table. */
export class NotificationsRepository extends BaseRepository<
  Notification,
  NotificationInput
> {
  constructor(client: SupabaseClient | null) {
    super(client, config);
  }

  /** All notifications for the given recipient, newest first. */
  findByRecipient(recipient: string): Promise<Result<readonly Notification[]>> {
    return this.find({
      filters: [{ column: "recipient", op: "eq", value: recipient }],
      orderBy: { column: "created_at", ascending: false },
    });
  }

  /** Unread notifications for the given recipient, newest first. */
  findUnread(recipient: string): Promise<Result<readonly Notification[]>> {
    return this.find({
      filters: [
        { column: "recipient", op: "eq", value: recipient },
        { column: "read", op: "eq", value: false },
      ],
      orderBy: { column: "created_at", ascending: false },
    });
  }

  /** Count of unread notifications for the given recipient. */
  countUnread(recipient: string): Promise<Result<number>> {
    return this.count({
      filters: [
        { column: "recipient", op: "eq", value: recipient },
        { column: "read", op: "eq", value: false },
      ],
    });
  }

  /** Mark a single notification as read. */
  markRead(id: string): Promise<Result<Notification>> {
    return this.update(id, { read: true });
  }
}

/** Factory: build a `NotificationsRepository` over the (possibly null) client. */
export function createNotificationsRepository(
  client: SupabaseClient | null,
): NotificationsRepository {
  return new NotificationsRepository(client);
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
