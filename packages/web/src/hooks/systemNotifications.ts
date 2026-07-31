"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Hex } from "viem";
import { useActivityFeed, type ActivityItem } from "@/hooks/overviewActivity";
import type { SemanticStatus } from "@/components/ui/StatusBadge";
import type { TimelineKind } from "@/lib/types";

/**
 * The System → Notifications feed (WD §6). Reuses the global on-chain activity
 * stream (`useActivityFeed`) and layers notification affordances on top: a
 * stable id, a semantic tone, a deep link, a category, and per-user read state
 * persisted in `localStorage`.
 */

const READ_KEY = "proofchain-notifications-read";

export type NotificationCategory = "provenance" | "settlement" | "dispute";

export interface Notification {
  readonly id: string;
  readonly kind: TimelineKind;
  readonly category: NotificationCategory;
  readonly title: string;
  readonly detail?: string;
  readonly batchId: Hex;
  readonly href: string;
  readonly tone: SemanticStatus;
  readonly blockNumber: bigint;
  readonly transactionHash: Hex;
  readonly read: boolean;
}

const TONE: Record<TimelineKind, SemanticStatus> = {
  registered: "info",
  checkpoint: "neutral",
  attested: "brand",
  funded: "brand",
  released: "success",
  disputed: "danger",
  refunded: "warn",
};

const CATEGORY: Record<TimelineKind, NotificationCategory> = {
  registered: "provenance",
  checkpoint: "provenance",
  attested: "provenance",
  funded: "settlement",
  released: "settlement",
  refunded: "settlement",
  disputed: "dispute",
};

export const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  provenance: "Provenance",
  settlement: "Settlement",
  dispute: "Disputes",
};

function idOf(item: ActivityItem): string {
  return `${item.transactionHash}-${item.logIndex}`;
}

function readSet(): ReadonlySet<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

export interface UseNotifications {
  readonly notifications: readonly Notification[];
  readonly unreadCount: number;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: unknown;
  readonly refetch: () => void;
  readonly markAllRead: () => void;
  readonly markRead: (id: string) => void;
}

/** Normalised, read-aware notification feed built on the on-chain activity log. */
export function useNotifications(): UseNotifications {
  const { activity, isLoading, isError, error, refetch } = useActivityFeed();
  const [read, setRead] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    setRead(readSet());
  }, []);

  const persist = useCallback((next: ReadonlySet<string>) => {
    setRead(next);
    try {
      window.localStorage.setItem(READ_KEY, JSON.stringify([...next]));
    } catch {
      // ignore storage failures
    }
  }, []);

  const notifications = useMemo<readonly Notification[]>(
    () =>
      activity.map((item) => {
        const id = idOf(item);
        return {
          id,
          kind: item.kind,
          category: CATEGORY[item.kind],
          title: item.title,
          detail: item.detail,
          batchId: item.batchId,
          href: `/explorer/${item.batchId}`,
          tone: TONE[item.kind],
          blockNumber: item.blockNumber,
          transactionHash: item.transactionHash,
          read: read.has(id),
        };
      }),
    [activity, read],
  );

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const markAllRead = useCallback(() => {
    persist(new Set(notifications.map((n) => n.id)));
  }, [notifications, persist]);

  const markRead = useCallback(
    (id: string) => {
      const next = new Set(read);
      next.add(id);
      persist(next);
    },
    [read, persist],
  );

  return {
    notifications,
    unreadCount,
    isLoading,
    isError,
    error,
    refetch: () => void refetch(),
    markAllRead,
    markRead,
  };
}
