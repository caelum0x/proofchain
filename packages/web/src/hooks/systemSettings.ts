"use client";

import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

/**
 * Persisted user preferences for the System → Settings page (WD §6). These are
 * client-side display/UX preferences kept in `localStorage` (there is no backend
 * user store); the theme itself is owned by `useTheme`. Every read is validated
 * with zod at the boundary so a malformed/old payload never crashes the UI.
 */

const STORAGE_KEY = "proofchain-settings";

export const settingsSchema = z.object({
  /** Default body view for list pages. */
  defaultView: z.enum(["table", "grid"]),
  /** Rows shown per page on list views. */
  pageSize: z.coerce.number().int().min(10).max(200),
  /** Preferred display currency label for amounts. */
  currency: z.enum(["USDC", "USD"]),
  /** Show live on-chain event toasts. */
  liveEvents: z.boolean(),
  /** Reduce non-essential motion regardless of OS setting. */
  reduceMotion: z.boolean(),
  /** Which notification categories to surface in the feed. */
  notifyProvenance: z.boolean(),
  notifySettlement: z.boolean(),
  notifyDisputes: z.boolean(),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  defaultView: "table",
  pageSize: 25,
  currency: "USDC",
  liveEvents: true,
  reduceMotion: false,
  notifyProvenance: true,
  notifySettlement: true,
  notifyDisputes: true,
};

function readSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = settingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export interface UseSettings {
  readonly settings: Settings;
  /** True once the persisted value has been hydrated on the client. */
  readonly isLoaded: boolean;
  readonly save: (next: Settings) => void;
  readonly reset: () => void;
}

/** Load + persist the user's display preferences (validated with zod). */
export function useSettings(): UseSettings {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setSettings(readSettings());
    setIsLoaded(true);
  }, []);

  const save = useCallback((next: Settings) => {
    const validated = settingsSchema.parse(next);
    setSettings(validated);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
    } catch {
      // Storage unavailable (private mode) — in-memory state still applies.
    }
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { settings, isLoaded, save, reset };
}
