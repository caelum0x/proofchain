/**
 * Subscriptions service — the snapshot layer behind Server-Sent Events (SSE).
 *
 * A true push stream needs a long-lived connection the indexer writes to; this
 * service provides the REPLAYABLE snapshot an SSE client receives on connect (or
 * reconnect with `Last-Event-ID`): the most recent rows for a channel, newest
 * first, normalized into `{ id, event, data }` frames. The `/subscriptions`
 * route serializes these into the `text/event-stream` wire format. Bounding the
 * snapshot keeps the endpoint deterministic and offline-testable.
 *
 * Channels: `events` (all indexer events), any module group name (scoped
 * events), or `notifications` (optionally filtered by recipient).
 */
import type { FilterValue } from '../lib/db.js';
import { validationError } from '../lib/errors.js';
import { FEED_GROUPS } from './feeds.js';
import { defineService } from './base.js';

/** Non-group channels a subscriber can attach to. */
const SPECIAL_CHANNELS = ['events', 'notifications'] as const;

export type SubscriptionChannel =
  | (typeof SPECIAL_CHANNELS)[number]
  | (typeof FEED_GROUPS)[number];

/** One normalized SSE frame. */
export interface SseFrame {
  readonly id: string;
  readonly event: string;
  readonly data: Record<string, unknown>;
}

export interface SnapshotInput {
  readonly channel: string;
  readonly limit: number;
  /** For the `notifications` channel: scope to one recipient. */
  readonly recipient?: string;
}

export interface SubscriptionsService {
  /** The channels a client may subscribe to. */
  channels(): readonly string[];
  /** Fetch the current replay snapshot for a channel as normalized frames. */
  snapshot(input: SnapshotInput): Promise<readonly SseFrame[]>;
}

const isValidChannel = (channel: string): boolean =>
  (SPECIAL_CHANNELS as readonly string[]).includes(channel) ||
  (FEED_GROUPS as readonly string[]).includes(channel);

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};

/** Build a {@link SubscriptionsService} bound to the request context. */
export const createSubscriptionsService = defineService<SubscriptionsService>(
  (ctx) => ({
    channels(): readonly string[] {
      return [...SPECIAL_CHANNELS, ...FEED_GROUPS];
    },

    async snapshot({ channel, limit, recipient }): Promise<readonly SseFrame[]> {
      if (!isValidChannel(channel)) {
        throw validationError(`unknown subscription channel '${channel}'`, {
          allowed: [...SPECIAL_CHANNELS, ...FEED_GROUPS],
        });
      }

      if (channel === 'notifications') {
        const filters: Record<string, FilterValue> = {};
        if (recipient !== undefined) filters.recipient = recipient;
        const rows = await ctx.db.list<Record<string, unknown>>('notifications', {
          ...(Object.keys(filters).length > 0 ? { filters } : {}),
          order: { column: 'created_at', ascending: false },
          limit,
        });
        return rows.map((row) => ({
          id: String(row.id ?? ''),
          event: String(row.kind ?? 'notification'),
          data: row,
        }));
      }

      const filters: Record<string, FilterValue> = {};
      if (channel !== 'events') filters.group_name = channel;
      const rows = await ctx.db.list<Record<string, unknown>>('indexer_events', {
        ...(Object.keys(filters).length > 0 ? { filters } : {}),
        order: { column: 'created_at', ascending: false },
        limit,
      });
      return rows.map((row) => ({
        id: String(row.id ?? `${row.contract ?? ''}-${row.block_number ?? ''}`),
        event: String(row.event_name ?? 'event'),
        data: asRecord(row.args ?? row),
      }));
    },
  }),
);
