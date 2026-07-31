"use client";

import { useCallback, useMemo } from "react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useActivityFeed, type ActivityItem } from "@/hooks/overviewActivity";
import { getErrorMessage } from "@/lib/errors";
import type { TimelineKind } from "@/lib/types";

/**
 * Data + export helpers for the System → Reports page (WD §6). Combines the
 * backend analytics overview with the on-chain activity stream to produce
 * downloadable operational reports. All figures come from `lib/api.ts`
 * (analytics) and wagmi reads (activity) — never hand-rolled.
 */

export type ReportKind = "activity" | "settlement" | "provenance";

export interface ReportOption {
  readonly value: ReportKind;
  readonly label: string;
  readonly description: string;
}

export const REPORT_OPTIONS: readonly ReportOption[] = [
  { value: "activity", label: "Full activity log", description: "Every lifecycle event across the protocol." },
  { value: "settlement", label: "Settlement report", description: "Escrow funding, releases, and refunds." },
  { value: "provenance", label: "Provenance report", description: "Batch registrations, checkpoints, attestations." },
];

const SETTLEMENT_KINDS: ReadonlySet<TimelineKind> = new Set(["funded", "released", "refunded"]);
const PROVENANCE_KINDS: ReadonlySet<TimelineKind> = new Set(["registered", "checkpoint", "attested"]);

function filterByKind(items: readonly ActivityItem[], kind: ReportKind): readonly ActivityItem[] {
  if (kind === "settlement") return items.filter((i) => SETTLEMENT_KINDS.has(i.kind));
  if (kind === "provenance") return items.filter((i) => PROVENANCE_KINDS.has(i.kind));
  return items;
}

/** Escape a single CSV field per RFC 4180. */
function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialise activity rows into a CSV document string. */
export function toActivityCsv(items: readonly ActivityItem[]): string {
  const header = ["event", "batchId", "detail", "block", "txHash"];
  const rows = items.map((i) =>
    [i.title, i.batchId, i.detail ?? "", i.blockNumber.toString(), i.transactionHash]
      .map((f) => csvField(String(f)))
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/** Trigger a browser download of a text payload. */
export function downloadTextFile(filename: string, contents: string, mime = "text/csv"): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export interface UseReports {
  readonly stats: ReturnType<typeof useAnalytics>["stats"];
  readonly health: ReturnType<typeof useAnalytics>["health"];
  readonly activity: readonly ActivityItem[];
  readonly isLoading: boolean;
  readonly apiError: string | null;
  readonly chainError: string | null;
  readonly refetch: () => void;
  /** Rows for the currently selected report kind. */
  readonly rowsFor: (kind: ReportKind) => readonly ActivityItem[];
  /** Build + download a CSV for the given report kind. */
  readonly exportCsv: (kind: ReportKind) => void;
}

export function useReports(): UseReports {
  const analytics = useAnalytics();
  const feed = useActivityFeed();

  const rowsFor = useCallback(
    (kind: ReportKind) => filterByKind(feed.activity, kind),
    [feed.activity],
  );

  const exportCsv = useCallback(
    (kind: ReportKind) => {
      const stamp = new Date().toISOString().slice(0, 10);
      downloadTextFile(`proofchain-${kind}-${stamp}.csv`, toActivityCsv(rowsFor(kind)));
    },
    [rowsFor],
  );

  const refetch = useCallback(() => {
    analytics.refetch();
    void feed.refetch();
  }, [analytics, feed]);

  const chainError = feed.isError ? getErrorMessage(feed.error) : null;

  return useMemo(
    () => ({
      stats: analytics.stats,
      health: analytics.health,
      activity: feed.activity,
      isLoading: analytics.isLoading || feed.isLoading,
      apiError: analytics.apiError,
      chainError,
      refetch,
      rowsFor,
      exportCsv,
    }),
    [analytics.stats, analytics.health, analytics.isLoading, analytics.apiError, feed.activity, feed.isLoading, chainError, refetch, rowsFor, exportCsv],
  );
}
