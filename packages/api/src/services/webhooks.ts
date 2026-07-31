/**
 * Webhooks service — outbound webhook SUBSCRIPTIONS + delivery audit.
 *
 * Integrators register an endpoint URL and a set of event topics they want
 * pushed (`webhooks` table); the indexer/notifier fans events out to them and
 * records each attempt in `webhook_deliveries`. This service owns the
 * read/registration surface only — actual HTTP delivery is an infra concern. It
 * degrades gracefully: reads return empty when Supabase is unconfigured, and
 * registration surfaces the typed DB_NOT_CONFIGURED error (a subscription with
 * nowhere to persist is a hard failure, never a silent success).
 */
import type { Pagination } from '../lib/pagination.js';
import { defineService, pageRows, type ListResult } from './base.js';

const TABLE = 'webhooks';
const DELIVERIES_TABLE = 'webhook_deliveries';

/** A registered webhook subscription as stored in the read model. */
export interface WebhookRow {
  readonly id: string;
  readonly url: string;
  readonly events: readonly string[];
  readonly active: boolean;
  readonly created_at?: string;
}

/** A single delivery attempt against a webhook. */
export interface WebhookDeliveryRow {
  readonly id: string;
  readonly webhook_id: string;
  readonly event: string;
  readonly status: string;
  readonly response_code: number | null;
  readonly created_at?: string;
}

export interface RegisterWebhookInput {
  readonly url: string;
  readonly events: readonly string[];
}

export interface WebhooksService {
  /** Register a webhook subscription, returning the stored row. */
  register(input: RegisterWebhookInput): Promise<WebhookRow>;
  /** Page registered webhooks. */
  list(pagination: Pagination): Promise<ListResult<WebhookRow>>;
  /** Resolve one webhook by id, or null. */
  get(id: string): Promise<WebhookRow | null>;
  /** Page delivery attempts for one webhook. */
  deliveries(
    id: string,
    pagination: Pagination,
  ): Promise<ListResult<WebhookDeliveryRow>>;
}

/** Build a {@link WebhooksService} bound to the request context. */
export const createWebhooksService = defineService<WebhooksService>((ctx) => ({
  async register({ url, events }): Promise<WebhookRow> {
    const row = {
      id: globalThis.crypto.randomUUID(),
      url,
      events: [...events],
      active: true,
      created_at: new Date().toISOString(),
    };
    return ctx.db.insert<WebhookRow>(TABLE, row);
  },

  async list(pagination): Promise<ListResult<WebhookRow>> {
    return pageRows<WebhookRow>(ctx.db, {
      table: TABLE,
      pagination,
      order: { column: 'created_at', ascending: false },
    });
  },

  async get(id): Promise<WebhookRow | null> {
    return ctx.db.getBy<WebhookRow>(TABLE, 'id', id);
  },

  async deliveries(id, pagination): Promise<ListResult<WebhookDeliveryRow>> {
    return pageRows<WebhookDeliveryRow>(ctx.db, {
      table: DELIVERIES_TABLE,
      pagination,
      filters: { webhook_id: id },
      order: { column: 'created_at', ascending: false },
    });
  },
}));
