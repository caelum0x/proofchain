/**
 * Notification channel registry. Channels self-register at module-load time so
 * adding a transport is purely additive (see storage/registry.ts for the same
 * pattern).
 */
import type { ChannelFactory } from "./types.js";

const registry = new Map<string, ChannelFactory>();

/** Register (or replace) a channel factory under `name`. */
export function registerChannel(name: string, factory: ChannelFactory): void {
  registry.set(name, factory);
}

/** Look up a registered channel factory, or `undefined`. */
export function getChannelFactory(name: string): ChannelFactory | undefined {
  return registry.get(name);
}

/** Names of all registered channels, sorted. */
export function registeredChannels(): readonly string[] {
  return [...registry.keys()].sort();
}
