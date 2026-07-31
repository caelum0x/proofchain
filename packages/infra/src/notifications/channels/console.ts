/**
 * Console / no-op notification channel — the always-available default.
 *
 * With no `log` sink in the context it is a silent no-op (delivered, skipped),
 * which is the safe default for production. Pass `{ log: console.log }` (or a
 * structured logger) to actually emit. Registered under the name "console".
 */
import { ok, type Result } from "../../errors.js";
import { registerChannel } from "../registry.js";
import type {
  ChannelContext,
  DeliveryResult,
  Notification,
  NotificationChannel,
} from "../types.js";

/** Build a console channel over an optional log sink. */
export function createConsoleChannel(context: ChannelContext = {}): NotificationChannel {
  const log = context.log;
  return {
    name: "console",
    async send(notification: Notification): Promise<Result<DeliveryResult>> {
      if (log === undefined) {
        return ok({ channel: "console", delivered: true, skipped: true, reason: "no log sink" });
      }
      log({
        channel: "console",
        kind: notification.kind,
        recipient: notification.recipient,
        title: notification.title,
        body: notification.body,
        payload: notification.payload,
      });
      return ok({ channel: "console", delivered: true });
    },
  };
}

registerChannel("console", (context) => createConsoleChannel(context));
