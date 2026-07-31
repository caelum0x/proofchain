"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Hex } from "viem";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { provenanceRegistryAbi } from "@/lib/abis";
import { contractAddresses } from "@/lib/shared";
import { env } from "@/lib/env";
import type { BatchRegisteredEvent } from "@/lib/types";

const QUERY_KEY = "batches";

/**
 * Discovers every registered batch by reading `BatchRegistered` logs, then keeps
 * the list live by subscribing to new events. The provenance registry has no
 * on-chain enumeration, so event indexing is the source of truth.
 */
export function useBatches() {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const address = contractAddresses.provenanceRegistry;

  const query = useQuery<BatchRegisteredEvent[]>({
    queryKey: [QUERY_KEY, env.chainId, address],
    enabled: Boolean(publicClient && address),
    queryFn: async () => {
      if (!publicClient || !address) return [];
      const logs = await publicClient.getContractEvents({
        address,
        abi: provenanceRegistryAbi,
        eventName: "BatchRegistered",
        fromBlock: env.deployBlock ?? "earliest",
        toBlock: "latest",
      });

      const seen = new Set<string>();
      const items: BatchRegisteredEvent[] = [];
      // Most-recent first.
      for (const log of [...logs].reverse()) {
        const { batchId, supplier, originHash, metadataURI } = log.args;
        if (!batchId || !supplier || seen.has(batchId)) continue;
        seen.add(batchId);
        items.push({
          batchId,
          supplier,
          originHash: originHash ?? ("0x" as Hex),
          metadataURI: metadataURI ?? "",
          blockNumber: log.blockNumber ?? 0n,
          transactionHash: log.transactionHash ?? ("0x" as Hex),
        });
      }
      return items;
    },
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [QUERY_KEY, env.chainId, address] });
  }, [queryClient, address]);

  useWatchContractEvent({
    address,
    abi: provenanceRegistryAbi,
    eventName: "BatchRegistered",
    enabled: Boolean(address),
    onLogs: () => invalidate(),
  });

  return {
    batches: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
