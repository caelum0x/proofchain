/**
 * Email notification channel.
 *
 * Delivery is delegated to an injectable `emailTransport` in the context so this
 * package stays dependency-free (wire it to Resend/SES/SMTP at the app edge).
 * With no transport it is a no-op skip; with no recipient it skips too.
 * Registered under the name "email".
 */
import { ok, err, InfraErrorCode, toEnvelope, type Result } from "../../errors.js";
import { registerChannel } from "../registry.js";
import type {
  ChannelContext,
  DeliveryResult,
  Notification,
  NotificationChannel,
} from "../types.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Build an email channel over an optional transport. */
export function createEmailChannel(context: ChannelContext = {}): NotificationChannel {
  const transport = context.emailTransport;
  return {
    name: "email",
    async send(notification: Notification): Promise<Result<DeliveryResult>> {
      if (transport === undefined) {
        return ok({
          channel: "email",
          delivered: false,
          skipped: true,
          reason: "no email transport configured",
        });
      }
      const to = notification.recipient;
      if (to === undefined || !EMAIL_RE.test(to)) {
        return ok({
          channel: "email",
          delivered: false,
          skipped: true,
          reason: "recipient is not an email address",
        });
      }
      try {
        const result = await transport({
          to,
          subject: notification.title ?? notification.kind,
          text: notification.body ?? "",
          kind: notification.kind,
        });
        return ok({
          channel: "email",
          delivered: true,
          ...(result.id !== undefined ? { id: result.id } : {}),
        });
      } catch (error) {
        return err(InfraErrorCode.UNEXPECTED, "Email delivery failed", {
          cause: toEnvelope(error),
        });
      }
    },
  };
}

registerChannel("email", (context) => createEmailChannel(context));
