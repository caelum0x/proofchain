"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address, Hex } from "viem";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { provenanceRegistryAbi } from "@/lib/abis";
import { contractAddresses } from "@/lib/shared";
import { env } from "@/lib/env";
import type { BatchRegisteredEvent } from "@/lib/types";

/**
 * Every batch registered by a given supplier, discovered from `BatchRegistered`
 * logs (the `supplier` topic is indexed, so this filters server-side at the RPC).
 * Powers the supplier profile page's shipment history.
 */
export function useSupplierBatches(supplier: Address | undefined) {
  const publicClient = usePublicClient();
  const address = contractAddresses.provenanceRegistry;

  const query = useQuery<BatchRegisteredEvent[]>({
    queryKey: ["supplier-batches", env.chainId, address, supplier],
    enabled: Boolean(publicClient && address && supplier),
    queryFn: async () => {
      if (!publicClient || !address || !supplier) return [];
      const logs = await publicClient.getContractEvents({
        address,
        abi: provenanceRegistryAbi,
        eventName: "BatchRegistered",
        args: { supplier },
        fromBlock: env.deployBlock ?? "earliest",
        toBlock: "latest",
      });
      const seen = new Set<string>();
      const items: BatchRegisteredEvent[] = [];
      for (const log of [...logs].reverse()) {
        const { batchId, supplier: sup, originHash, metadataURI } = log.args;
        if (!batchId || !sup || seen.has(batchId)) continue;
        seen.add(batchId);
        items.push({
          batchId,
          supplier: sup,
          originHash: originHash ?? ("0x" as Hex),
          metadataURI: metadataURI ?? "",
          blockNumber: log.blockNumber ?? 0n,
          transactionHash: log.transactionHash ?? ("0x" as Hex),
        });
      }
      return items;
    },
  });

  const refetch = useCallback(() => void query.refetch(), [query]);

  useWatchContractEvent({
    address,
    abi: provenanceRegistryAbi,
    eventName: "BatchRegistered",
    args: supplier ? { supplier } : undefined,
    enabled: Boolean(address && supplier),
    onLogs: () => void query.refetch(),
  });

  return {
    batches: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    refetch,
  };
}
