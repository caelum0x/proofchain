/**
 * Notifications service — the aggregation layer behind the app notification
 * center, feeds, and SSE subscriptions.
 *
 * The `notifications` read-model table (append-only: recipient, kind, payload,
 * read flag) is populated by the indexer/notifier. This service centralizes the
 * read + read-state moves so the `/feeds` and `/subscriptions` routes (and any
 * future notification route) share ONE implementation. The foundation's
 * `/notifications` route serves the same table directly; this service is the
 * reusable, unit-testable counterpart consumed by the cross-cutting routes.
 */
import type { FilterValue } from '../lib/db.js';
import type { Pagination } from '../lib/pagination.js';
import { defineService, pageRows, type ListResult } from './base.js';

const TABLE = 'notifications';

/** A notification as stored in the read model. */
export interface NotificationRow {
  readonly id: string;
  readonly recipient: string;
  readonly kind: string;
  readonly payload: Record<string, unknown> | null;
  readonly read: boolean;
  readonly created_at?: string;
}

export interface NotificationQuery {
  readonly pagination: Pagination;
  readonly recipient?: string;
  readonly kind?: string;
  readonly read?: boolean;
}

export interface NotificationsService {
  /** Page notifications, optionally scoped by recipient / kind / read flag. */
  list(query: NotificationQuery): Promise<ListResult<NotificationRow>>;
  /** Count unread notifications for a recipient. */
  unreadCount(recipient: string): Promise<number>;
  /** Resolve one notification by id, or null. */
  get(id: string): Promise<NotificationRow | null>;
  /** Mark a notification read (idempotent upsert), returning the stored row. */
  markRead(id: string): Promise<NotificationRow | null>;
}

/** Build a {@link NotificationsService} bound to the request context. */
export const createNotificationsService = defineService<NotificationsService>(
  (ctx) => ({
    async list({
      pagination,
      recipient,
      kind,
      read,
    }): Promise<ListResult<NotificationRow>> {
      const filters: Record<string, FilterValue> = {};
      if (recipient !== undefined) filters.recipient = recipient;
      if (kind !== undefined) filters.kind = kind;
      if (read !== undefined) filters.read = read;
      return pageRows<NotificationRow>(ctx.db, {
        table: TABLE,
        pagination,
        ...(Object.keys(filters).length > 0 ? { filters } : {}),
        order: { column: 'created_at', ascending: false },
      });
    },

    async unreadCount(recipient): Promise<number> {
      return ctx.db.count(TABLE, { recipient, read: false });
    },

    async get(id): Promise<NotificationRow | null> {
      return ctx.db.getBy<NotificationRow>(TABLE, 'id', id);
    },

    async markRead(id): Promise<NotificationRow | null> {
      const existing = await ctx.db.getBy<NotificationRow>(TABLE, 'id', id);
      if (existing === null) return null;
      if (existing.read === true) return existing;
      return ctx.db.upsert<NotificationRow>(
        TABLE,
        { ...existing, read: true },
        'id',
      );
    },
  }),
);
