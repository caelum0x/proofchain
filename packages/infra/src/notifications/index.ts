/**
 * Notifications subsystem entrypoint.
 *
 * Importing this module wires up every registered channel (via the generated
 * `channels/index.ts` barrel) and exposes:
 *   * `createChannel(name, context)` — build one channel by name.
 *   * `createNotifier(context, names)` — a multi-channel dispatcher that
 *     validates once and fans out, aggregating per-channel delivery results.
 *
 * The default channel set is `["console"]` (a safe no-op unless a log sink is
 * provided). Fill convention: add `channels/<transport>.ts`, self-register, run
 * `pnpm run barrels`.
 */
import { ok, err, InfraErrorCode, InfraError, type Result } from "../errors.js";
import {
  Notification,
  type ChannelContext,
  type DeliveryResult,
  type Notification as NotificationT,
  type NotificationChannel,
} from "./types.js";
import { getChannelFactory, registeredChannels } from "./registry.js";
// Side-effect import: evaluates every channel module so they self-register.
import "./channels/index.js";

export type {
  Notification,
  NotificationChannel,
  ChannelContext,
  ChannelFactory,
  DeliveryResult,
  EmailMessage,
} from "./types.js";
export { Notification as NotificationSchema } from "./types.js";
export {
  registerChannel,
  getChannelFactory,
  registeredChannels,
} from "./registry.js";

/** A multi-channel dispatcher. */
export interface Notifier {
  readonly channels: readonly string[];
  notify(notification: NotificationT): Promise<Result<readonly DeliveryResult[]>>;
}

/**
 * Build a single channel by name. Throws `InfraError` for an unknown name (a
 * programmer error surfaced at startup).
 */
export function createChannel(
  name: string,
  context: ChannelContext = {},
): NotificationChannel {
  const factory = getChannelFactory(name);
  if (factory === undefined) {
    throw new InfraError(InfraErrorCode.NOT_CONFIGURED, `Unknown channel "${name}"`, {
      available: registeredChannels(),
    });
  }
  return factory(context);
}

/**
 * Build a dispatcher over the named channels (default `["console"]`). Unknown
 * names throw at construction time.
 */
export function createNotifier(
  context: ChannelContext = {},
  names: readonly string[] = ["console"],
): Notifier {
  const channels = names.map((name) => createChannel(name, context));
  return {
    channels: names,
    async notify(
      notification: NotificationT,
    ): Promise<Result<readonly DeliveryResult[]>> {
      const parsed = Notification.safeParse(notification);
      if (!parsed.success) {
        return err(InfraErrorCode.VALIDATION, "Invalid notification", {
          issues: parsed.error.issues,
        });
      }
      const results = await Promise.all(
        channels.map(async (channel): Promise<DeliveryResult> => {
          const result = await channel.send(parsed.data);
          if (result.success) return result.data;
          // A single channel failure never fails the whole dispatch.
          return {
            channel: channel.name,
            delivered: false,
            reason: result.error.message,
          };
        }),
      );
      return ok(results);
    },
  };
}
