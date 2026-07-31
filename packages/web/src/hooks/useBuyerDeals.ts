"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address, Hex } from "viem";
import { usePublicClient, useReadContracts, useWatchContractEvent } from "wagmi";
import { settlementEscrowAbi } from "@/lib/abis";
import { contractAddresses } from "@/lib/shared";
import { decodeDeal } from "@/lib/decode";
import { env } from "@/lib/env";
import type { DealView } from "@/lib/types";

/**
 * Every escrow deal funded by a given buyer. Discovered from `Funded` logs (the
 * `buyer` topic is indexed) and then re-read via `getDeal` so the CURRENT state
 * (Funded / Released / Disputed / Refunded) is authoritative rather than stale.
 */
export function useBuyerDeals(buyer: Address | undefined) {
  const publicClient = usePublicClient();
  const escrow = contractAddresses.settlementEscrow;

  const batchIdsQuery = useQuery<Hex[]>({
    queryKey: ["buyer-deal-ids", env.chainId, escrow, buyer],
    enabled: Boolean(publicClient && escrow && buyer),
    queryFn: async () => {
      if (!publicClient || !escrow || !buyer) return [];
      const logs = await publicClient.getContractEvents({
        address: escrow,
        abi: settlementEscrowAbi,
        eventName: "Funded",
        args: { buyer },
        fromBlock: env.deployBlock ?? "earliest",
        toBlock: "latest",
      });
      const seen = new Set<string>();
      const ids: Hex[] = [];
      for (const log of [...logs].reverse()) {
        const batchId = log.args.batchId;
        if (!batchId || seen.has(batchId)) continue;
        seen.add(batchId);
        ids.push(batchId);
      }
      return ids;
    },
  });

  const batchIds = useMemo(() => batchIdsQuery.data ?? [], [batchIdsQuery.data]);

  const dealsQuery = useReadContracts({
    contracts: escrow
      ? batchIds.map((batchId) => ({
          address: escrow,
          abi: settlementEscrowAbi,
          functionName: "getDeal" as const,
          args: [batchId] as const,
        }))
      : [],
    query: { enabled: Boolean(escrow) && batchIds.length > 0 },
  });

  const deals = useMemo<DealView[]>(() => {
    const rows = dealsQuery.data;
    if (!rows) return [];
    const out: DealView[] = [];
    for (const row of rows) {
      if (row.status !== "success" || !row.result) continue;
      out.push(decodeDeal(row.result as Parameters<typeof decodeDeal>[0]));
    }
    return out;
  }, [dealsQuery.data]);

  const refetch = useCallback(() => {
    void batchIdsQuery.refetch();
    void dealsQuery.refetch();
  }, [batchIdsQuery, dealsQuery]);

  useWatchContractEvent({
    address: escrow,
    abi: settlementEscrowAbi,
    eventName: "Funded",
    args: buyer ? { buyer } : undefined,
    enabled: Boolean(escrow && buyer),
    onLogs: () => void batchIdsQuery.refetch(),
  });

  const hasIds = batchIds.length > 0;

  return {
    deals,
    isLoading: batchIdsQuery.isLoading || (hasIds && dealsQuery.isLoading),
    isError: batchIdsQuery.isError || dealsQuery.isError,
    error: batchIdsQuery.error ?? dealsQuery.error ?? null,
    refetch,
  };
}
