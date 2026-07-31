"use client";

import { useMemo } from "react";
import type { Hex } from "viem";
import { useReadContracts } from "wagmi";
import { attestationRegistryAbi, settlementEscrowAbi } from "@/lib/abis";
import { contractAddresses } from "@/lib/shared";
import { DealState, type DealStateValue } from "@/lib/types";

/** Attestation + settlement status for one batch, for the explorer table. */
export interface BatchStatus {
  readonly attested: boolean;
  readonly score?: number; // bps
  readonly dealState: DealStateValue;
}

/**
 * Enrich a page of batches with their attestation score and settlement state in
 * one multicall (three reads per batch). Keyed by lowercased batchId so the
 * explorer table can render live status without an N+1 fan-out of hooks.
 */
export function useBatchStatuses(batchIds: readonly Hex[]) {
  const attestation = contractAddresses.attestationRegistry;
  const escrow = contractAddresses.settlementEscrow;

  const contracts = useMemo(() => {
    const list: Array<Record<string, unknown>> = [];
    for (const batchId of batchIds) {
      if (attestation) {
        list.push({ address: attestation, abi: attestationRegistryAbi, functionName: "isAttested", args: [batchId] });
        list.push({ address: attestation, abi: attestationRegistryAbi, functionName: "scoreOf", args: [batchId] });
      }
      if (escrow) {
        list.push({ address: escrow, abi: settlementEscrowAbi, functionName: "getDeal", args: [batchId] });
      }
    }
    return list;
  }, [batchIds, attestation, escrow]);

  const query = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: contracts as any,
    query: { enabled: contracts.length > 0 },
  });

  const statuses = useMemo(() => {
    const map = new Map<string, BatchStatus>();
    const rows = query.data;
    if (!rows) return map;
    const perBatch = (attestation ? 2 : 0) + (escrow ? 1 : 0);
    if (perBatch === 0) return map;

    batchIds.forEach((batchId, i) => {
      const base = i * perBatch;
      let cursor = base;
      let attested = false;
      let score: number | undefined;
      let dealState: DealStateValue = DealState.None;

      if (attestation) {
        const isAttestedRow = rows[cursor++];
        const scoreRow = rows[cursor++];
        if (isAttestedRow?.status === "success") attested = Boolean(isAttestedRow.result);
        if (scoreRow?.status === "success") score = Number(scoreRow.result);
      }
      if (escrow) {
        const dealRow = rows[cursor++];
        if (dealRow?.status === "success" && dealRow.result) {
          const raw = dealRow.result as { state?: number };
          const s = Number(raw.state ?? 0);
          const values = Object.values(DealState) as DealStateValue[];
          dealState = values.find((v) => v === s) ?? DealState.None;
        }
      }

      map.set(batchId.toLowerCase(), {
        attested,
        score: attested ? score : undefined,
        dealState,
      });
    });
    return map;
  }, [query.data, batchIds, attestation, escrow]);

  return {
    statuses,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
  };
}
