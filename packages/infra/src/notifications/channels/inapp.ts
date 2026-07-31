/**
 * In-app notification channel — persists to the `notifications` table so the
 * web/app can surface an inbox.
 *
 * No-op-safe: with no Supabase client in the context it resolves to a skipped
 * delivery (never an error). The recipient is stored only when it is a valid
 * lowercase address (matching the table's CHECK); otherwise it is null.
 * Registered under the name "inapp".
 */
import { ok, err, InfraErrorCode, toEnvelope, type Result } from "../../errors.js";
import { registerChannel } from "../registry.js";
import type {
  ChannelContext,
  DeliveryResult,
  Notification,
  NotificationChannel,
} from "../types.js";

const ADDRESS_RE = /^0x[0-9a-f]{40}$/;

/** Build an in-app channel over an optional Supabase client. */
export function createInAppChannel(context: ChannelContext = {}): NotificationChannel {
  const client = context.client ?? null;
  return {
    name: "inapp",
    async send(notification: Notification): Promise<Result<DeliveryResult>> {
      if (client === null) {
        return ok({
          channel: "inapp",
          delivered: false,
          skipped: true,
          reason: "supabase not configured",
        });
      }
      const recipient =
        notification.recipient !== undefined && ADDRESS_RE.test(notification.recipient)
          ? notification.recipient
          : null;
      try {
        const { data, error } = await client
          .from("notifications")
          .insert({
            recipient,
            kind: notification.kind,
            payload: {
              title: notification.title ?? null,
              body: notification.body ?? null,
              ...notification.payload,
            },
          })
          .select("id")
          .single();
        if (error) {
          return err(InfraErrorCode.SUPABASE, error.message, { channel: "inapp" });
        }
        const id = (data as { id?: string } | null)?.id;
        return ok({
          channel: "inapp",
          delivered: true,
          ...(id !== undefined ? { id } : {}),
        });
      } catch (error) {
        return err(InfraErrorCode.SUPABASE, "In-app delivery failed", {
          cause: toEnvelope(error),
        });
      }
    },
  };
}

registerChannel("inapp", (context) => createInAppChannel(context));
