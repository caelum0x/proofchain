"use client";

import { useMemo } from "react";
import { useBatches } from "@/hooks/useBatches";
import { useCheckpointFeed } from "@/hooks/provenanceCheckpoints";
import { useAttestationFeed } from "@/hooks/provenanceAttestations";
import { useActivityFeed } from "@/hooks/overviewActivity";

/** Aggregate, live on-chain metrics powering the dashboard + analytics pages. */
export interface OverviewMetrics {
  readonly batches: number;
  readonly checkpoints: number;
  readonly attestations: number;
  readonly passed: number;
  readonly failed: number;
  /** Pass rate in basis points (0..10000). */
  readonly passRateBps: number;
  /** Average attestation score in basis points. */
  readonly avgScoreBps: number;
  readonly funded: number;
  readonly released: number;
  readonly disputed: number;
  readonly refunded: number;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
}

/**
 * Composes the section's live feeds into one metrics view. Everything is derived
 * from real on-chain events, so the dashboard stays truthful even when the
 * backend analytics API is offline.
 */
export function useOverviewMetrics(): OverviewMetrics {
  const batches = useBatches();
  const checkpoints = useCheckpointFeed();
  const attestations = useAttestationFeed();
  const activity = useActivityFeed();

  return useMemo(() => {
    const threshold = attestations.passThreshold;
    const scores = attestations.attestations.map((a) => a.score);
    const passed = scores.filter((s) => s >= threshold).length;
    const failed = scores.length - passed;
    const avgScoreBps = scores.length
      ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
      : 0;
    const passRateBps = scores.length ? Math.round((passed / scores.length) * 10000) : 0;

    const byKind = (kind: string) => activity.activity.filter((a) => a.kind === kind).length;

    return {
      batches: batches.batches.length,
      checkpoints: checkpoints.checkpoints.length,
      attestations: attestations.attestations.length,
      passed,
      failed,
      passRateBps,
      avgScoreBps,
      funded: byKind("funded"),
      released: byKind("released"),
      disputed: byKind("disputed"),
      refunded: byKind("refunded"),
      isLoading:
        batches.isLoading || checkpoints.isLoading || attestations.isLoading || activity.isLoading,
      isError: batches.isError || checkpoints.isError || attestations.isError || activity.isError,
      error:
        (batches.isError && batches.error ? String(batches.error) : null) ??
        (activity.isError && activity.error ? String(activity.error) : null),
      refetch: () => {
        void batches.refetch();
        void checkpoints.refetch();
        void attestations.refetch();
        void activity.refetch();
      },
    };
  }, [batches, checkpoints, attestations, activity]);
}
