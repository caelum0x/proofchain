/**
 * Webhook notification channel — POSTs the notification as JSON.
 *
 * Target resolution: the notification's `recipient` (when it is an http(s) URL),
 * else the context `webhookUrl` default. With neither, it is a no-op skip.
 * `fetch` is injectable for offline tests. Registered under the name "webhook".
 */
import { ok, err, InfraErrorCode, toEnvelope, type Result } from "../../errors.js";
import { registerChannel } from "../registry.js";
import type {
  ChannelContext,
  DeliveryResult,
  Notification,
  NotificationChannel,
} from "../types.js";

const TIMEOUT_MS = 15_000;

/** Build a webhook channel over an optional fetch + default endpoint. */
export function createWebhookChannel(context: ChannelContext = {}): NotificationChannel {
  const doFetch = context.fetchFn ?? ((url: string, init: RequestInit) => fetch(url, init));
  const defaultUrl = context.webhookUrl;

  return {
    name: "webhook",
    async send(notification: Notification): Promise<Result<DeliveryResult>> {
      const target = resolveTarget(notification.recipient, defaultUrl);
      if (target === null) {
        return ok({
          channel: "webhook",
          delivered: false,
          skipped: true,
          reason: "no webhook URL configured",
        });
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await doFetch(target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: notification.kind,
            title: notification.title,
            body: notification.body,
            payload: notification.payload,
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          return err(InfraErrorCode.NETWORK, "Webhook delivery failed", {
            status: response.status,
            statusText: response.statusText,
          });
        }
        return ok({ channel: "webhook", delivered: true });
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        return err(
          InfraErrorCode.NETWORK,
          aborted ? "Webhook request timed out" : "Webhook request errored",
          { cause: toEnvelope(error) },
        );
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function resolveTarget(recipient: string | undefined, fallback: string | undefined): string | null {
  if (recipient !== undefined && /^https?:\/\//i.test(recipient)) return recipient;
  if (fallback !== undefined && /^https?:\/\//i.test(fallback)) return fallback;
  return null;
}

registerChannel("webhook", (context) => createWebhookChannel(context));
