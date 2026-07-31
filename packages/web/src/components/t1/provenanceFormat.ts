import type { SemanticStatus } from "@/components/ui/StatusBadge";
import { DealState, type DealStateValue, type TimelineKind } from "@/lib/types";
import { formatBps } from "@/lib/format";
import type { RecallReason } from "@/hooks/provenanceRecalls";

/** Default rows-per-page for the section's list bodies. */
export const PAGE_SIZE = 10;

export interface StatusView {
  readonly label: string;
  readonly status: SemanticStatus;
}

/** Attestation verdict → badge label + tone. */
export function attestationStatus(
  attested: boolean,
  score: number | undefined,
  threshold: number,
): StatusView {
  if (!attested || score === undefined) return { label: "Pending", status: "neutral" };
  return score >= threshold
    ? { label: `PASS · ${formatBps(score)}`, status: "success" }
    : { label: `FAIL · ${formatBps(score)}`, status: "danger" };
}

const DEAL_STATUS: Record<DealStateValue, StatusView> = {
  [DealState.None]: { label: "No deal", status: "neutral" },
  [DealState.Funded]: { label: "Funded", status: "brand" },
  [DealState.Released]: { label: "Settled", status: "success" },
  [DealState.Refunded]: { label: "Refunded", status: "warn" },
  [DealState.Disputed]: { label: "Disputed", status: "danger" },
};

/** Settlement deal state → badge label + tone. */
export function dealStatus(state: DealStateValue): StatusView {
  return DEAL_STATUS[state] ?? { label: "Unknown", status: "neutral" };
}

const ACTIVITY_TONE: Record<TimelineKind, SemanticStatus> = {
  registered: "brand",
  checkpoint: "info",
  attested: "success",
  funded: "brand",
  released: "success",
  disputed: "danger",
  refunded: "warn",
};

/** Timeline/activity event kind → dot tone. */
export function activityTone(kind: TimelineKind): SemanticStatus {
  return ACTIVITY_TONE[kind] ?? "neutral";
}

const RECALL: Record<RecallReason, StatusView> = {
  "failed-verification": { label: "Failed verification", status: "danger" },
  disputed: { label: "Disputed", status: "warn" },
};

/** Recall reason → badge label + tone. */
export function recallStatus(reason: RecallReason): StatusView {
  return RECALL[reason];
}
