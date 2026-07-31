/**
 * Notification channel interface + schemas.
 *
 * A channel delivers a `Notification` over one transport (console, webhook,
 * email, in-app). Every channel is non-throwing (returns a `Result`) and
 * no-op-safe: when its transport is unconfigured it resolves to a `skipped`
 * delivery rather than an error, so a missing provider never breaks a flow.
 *
 * Fill convention: add one channel per transport under
 * `src/notifications/channels/`, self-register via `registerChannel(...)`, then
 * run `pnpm run barrels`.
 */
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InfraConfig } from "../env.js";
import type { Result } from "../errors.js";

/** A transport-agnostic notification payload. */
export const Notification = z.object({
  /** Machine-readable event kind (e.g. "deal.funded"). */
  kind: z.string().min(1),
  /** Destination: an address, email, or URL — interpreted per channel. */
  recipient: z.string().optional(),
  /** Short human title. */
  title: z.string().optional(),
  /** Human body text. */
  body: z.string().optional(),
  /** Structured data carried with the notification. */
  payload: z.record(z.unknown()).default({}),
});
export type Notification = z.infer<typeof Notification>;

/** Outcome of a single channel delivery attempt. */
export interface DeliveryResult {
  /** Channel name that produced this result. */
  readonly channel: string;
  /** Whether the notification was actually delivered. */
  readonly delivered: boolean;
  /** True when the channel was a no-op (unconfigured / not applicable). */
  readonly skipped?: boolean;
  /** Provider-assigned id, when available. */
  readonly id?: string;
  /** Human-readable reason for a skip or partial delivery. */
  readonly reason?: string;
}

/** An outbound email, used by the email channel transport. */
export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly kind: string;
}

/**
 * Dependencies injected into channel factories. All optional — channels degrade
 * to a no-op when the piece they need is absent.
 */
export interface ChannelContext {
  readonly config?: InfraConfig;
  /** Supabase client for the in-app channel (null / absent → skip). */
  readonly client?: SupabaseClient | null;
  /** Injectable fetch for the webhook channel. */
  readonly fetchFn?: (url: string, init: RequestInit) => Promise<Response>;
  /** Default webhook endpoint when a notification carries no recipient URL. */
  readonly webhookUrl?: string;
  /** Email transport (absent → email channel is a no-op). */
  readonly emailTransport?: (msg: EmailMessage) => Promise<{ id?: string }>;
  /** Console sink (absent → console channel is a silent no-op). */
  readonly log?: (entry: Readonly<Record<string, unknown>>) => void;
}

/** A pluggable notification channel. */
export interface NotificationChannel {
  readonly name: string;
  send(notification: Notification): Promise<Result<DeliveryResult>>;
}

/** Factory that builds a channel from an injected context. */
export type ChannelFactory = (context: ChannelContext) => NotificationChannel;
