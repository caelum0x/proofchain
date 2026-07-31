"use client";

import { useCallback } from "react";
import type { Hex } from "viem";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { provenanceRegistryAbi } from "@/lib/abis";
import { contractAddresses } from "@/lib/shared";
import { env } from "@/lib/env";

/** A single checkpoint discovered from a `CheckpointAdded` event, network-wide. */
export interface CheckpointFeedItem {
  readonly batchId: Hex;
  readonly location: string;
  readonly timestamp: number;
  readonly dataHash: Hex;
  readonly blockNumber: bigint;
  readonly transactionHash: Hex;
  readonly logIndex: number;
}

const QUERY_KEY = "checkpoint-feed";

/**
 * Network-wide checkpoint feed: every `CheckpointAdded` event across all batches,
 * most-recent first, kept live via a contract-event subscription. Powers the
 * Checkpoints list and the Materials/Recycling provenance lenses.
 */
export function useCheckpointFeed() {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const address = contractAddresses.provenanceRegistry;

  const query = useQuery<CheckpointFeedItem[]>({
    queryKey: [QUERY_KEY, env.chainId, address],
    enabled: Boolean(publicClient && address),
    queryFn: async () => {
      if (!publicClient || !address) return [];
      const logs = await publicClient.getContractEvents({
        address,
        abi: provenanceRegistryAbi,
        eventName: "CheckpointAdded",
        fromBlock: env.deployBlock ?? "earliest",
        toBlock: "latest",
      });
      return [...logs].reverse().map((log) => ({
        batchId: log.args.batchId ?? ("0x" as Hex),
        location: log.args.location ?? "",
        timestamp: log.args.timestamp ? Number(log.args.timestamp) : 0,
        dataHash: log.args.dataHash ?? ("0x" as Hex),
        blockNumber: log.blockNumber ?? 0n,
        transactionHash: log.transactionHash ?? ("0x" as Hex),
        logIndex: log.logIndex ?? 0,
      }));
    },
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [QUERY_KEY, env.chainId, address] });
  }, [queryClient, address]);

  useWatchContractEvent({
    address,
    abi: provenanceRegistryAbi,
    eventName: "CheckpointAdded",
    enabled: Boolean(address),
    onLogs: () => invalidate(),
  });

  return {
    checkpoints: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
