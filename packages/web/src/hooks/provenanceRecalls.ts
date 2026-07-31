"use client";

import { useMemo } from "react";
import type { Address, Hex } from "viem";
import { useBatches } from "@/hooks/useBatches";
import { useBatchStatuses } from "@/hooks/useBatchStatuses";
import { DealState } from "@/lib/types";

export type RecallReason = "failed-verification" | "disputed";

/** A batch flagged for recall, derived from live attestation + settlement state. */
export interface RecallItem {
  readonly batchId: Hex;
  readonly supplier: Address;
  readonly reason: RecallReason;
  readonly score?: number;
}

/**
 * Derives the recall register from real on-chain state: a batch is flagged when
 * its AI attestation scored below the pass threshold ("failed verification") or
 * its escrow deal was disputed. No separate registry contract is required — the
 * recall signal is inherent in the provenance + settlement data.
 */
export function useRecalls() {
  const { batches, isLoading: batchesLoading, isError, error, refetch } = useBatches();
  const batchIds = useMemo(() => batches.map((b) => b.batchId), [batches]);
  const { statuses, isLoading: statusLoading } = useBatchStatuses(batchIds);

  // The pass threshold is read per-batch inside statuses via score; we compare
  // against the network default surfaced by the attestation feed elsewhere. Here
  // a missing/undefined score with an attested flag is treated as unknown.
  const recalls = useMemo<RecallItem[]>(() => {
    const out: RecallItem[] = [];
    for (const batch of batches) {
      const status = statuses.get(batch.batchId.toLowerCase());
      if (!status) continue;
      if (status.dealState === DealState.Disputed) {
        out.push({ batchId: batch.batchId, supplier: batch.supplier, reason: "disputed", score: status.score });
      } else if (status.attested && status.score !== undefined && status.score < 7000) {
        out.push({ batchId: batch.batchId, supplier: batch.supplier, reason: "failed-verification", score: status.score });
      }
    }
    return out;
  }, [batches, statuses]);

  return {
    recalls,
    total: batches.length,
    isLoading: batchesLoading || statusLoading,
    isError,
    error,
    refetch,
  };
}
