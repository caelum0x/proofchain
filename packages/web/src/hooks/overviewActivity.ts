"use client";

import { useCallback } from "react";
import type { Hex } from "viem";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import {
  attestationRegistryAbi,
  provenanceRegistryAbi,
  settlementEscrowAbi,
} from "@/lib/abis";
import { contractAddresses } from "@/lib/shared";
import { env } from "@/lib/env";
import { formatBps, formatTokenAmount } from "@/lib/format";
import type { TimelineKind } from "@/lib/types";

const USDC_DECIMALS = 6;
const QUERY_KEY = "activity-feed";

/** A single normalized entry in the network-wide activity feed. */
export interface ActivityItem {
  readonly kind: TimelineKind;
  readonly batchId: Hex;
  readonly title: string;
  readonly detail?: string;
  readonly blockNumber: bigint;
  readonly logIndex: number;
  readonly transactionHash: Hex;
}

/**
 * The global activity feed (WD §6 Overview → Activity): every lifecycle event
 * across provenance + settlement contracts merged into one time-ordered stream,
 * most recent first. Live via contract-event subscriptions.
 */
export function useActivityFeed() {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const { provenanceRegistry, attestationRegistry, settlementEscrow } = contractAddresses;

  const query = useQuery<ActivityItem[]>({
    queryKey: [QUERY_KEY, env.chainId, provenanceRegistry, attestationRegistry, settlementEscrow],
    enabled: Boolean(publicClient),
    queryFn: async () => {
      if (!publicClient) return [];
      const fromBlock = env.deployBlock ?? "earliest";
      const items: ActivityItem[] = [];

      const [registered, checkpoints, attested, funded, released, disputed, refunded] =
        await Promise.all([
          provenanceRegistry
            ? publicClient.getContractEvents({ address: provenanceRegistry, abi: provenanceRegistryAbi, eventName: "BatchRegistered", fromBlock, toBlock: "latest" })
            : [],
          provenanceRegistry
            ? publicClient.getContractEvents({ address: provenanceRegistry, abi: provenanceRegistryAbi, eventName: "CheckpointAdded", fromBlock, toBlock: "latest" })
            : [],
          attestationRegistry
            ? publicClient.getContractEvents({ address: attestationRegistry, abi: attestationRegistryAbi, eventName: "Attested", fromBlock, toBlock: "latest" })
            : [],
          settlementEscrow
            ? publicClient.getContractEvents({ address: settlementEscrow, abi: settlementEscrowAbi, eventName: "Funded", fromBlock, toBlock: "latest" })
            : [],
          settlementEscrow
            ? publicClient.getContractEvents({ address: settlementEscrow, abi: settlementEscrowAbi, eventName: "Released", fromBlock, toBlock: "latest" })
            : [],
          settlementEscrow
            ? publicClient.getContractEvents({ address: settlementEscrow, abi: settlementEscrowAbi, eventName: "Disputed", fromBlock, toBlock: "latest" })
            : [],
          settlementEscrow
            ? publicClient.getContractEvents({ address: settlementEscrow, abi: settlementEscrowAbi, eventName: "Refunded", fromBlock, toBlock: "latest" })
            : [],
        ]);

      const push = (
        kind: TimelineKind,
        title: string,
        detail: string | undefined,
        log: { args: Record<string, unknown>; blockNumber: bigint | null; logIndex: number | null; transactionHash: Hex | null },
      ) => {
        items.push({
          kind,
          title,
          detail,
          batchId: (log.args.batchId as Hex) ?? ("0x" as Hex),
          blockNumber: log.blockNumber ?? 0n,
          logIndex: log.logIndex ?? 0,
          transactionHash: log.transactionHash ?? ("0x" as Hex),
        });
      };

      for (const log of registered) push("registered", "Batch registered", undefined, log);
      for (const log of checkpoints) push("checkpoint", "Checkpoint added", (log.args.location as string) || undefined, log);
      for (const log of attested) push("attested", "Attested by agent", log.args.score !== undefined ? `Score ${formatBps(Number(log.args.score))}` : undefined, log);
      for (const log of funded) push("funded", "Escrow funded", log.args.amount !== undefined ? `${formatTokenAmount(log.args.amount as bigint, USDC_DECIMALS)} USDC` : undefined, log);
      for (const log of released) push("released", "Settled — released", log.args.amount !== undefined ? `${formatTokenAmount(log.args.amount as bigint, USDC_DECIMALS)} to supplier` : undefined, log);
      for (const log of disputed) push("disputed", "Disputed", log.args.score !== undefined ? `Score ${formatBps(Number(log.args.score))}` : undefined, log);
      for (const log of refunded) push("refunded", "Refunded to buyer", log.args.amount !== undefined ? `${formatTokenAmount(log.args.amount as bigint, USDC_DECIMALS)} returned` : undefined, log);

      items.sort((a, b) =>
        a.blockNumber === b.blockNumber
          ? b.logIndex - a.logIndex
          : a.blockNumber < b.blockNumber
            ? 1
            : -1,
      );
      return items;
    },
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
  }, [queryClient]);

  useWatchContractEvent({
    address: provenanceRegistry,
    abi: provenanceRegistryAbi,
    eventName: "BatchRegistered",
    enabled: Boolean(provenanceRegistry),
    onLogs: () => invalidate(),
  });
  useWatchContractEvent({
    address: attestationRegistry,
    abi: attestationRegistryAbi,
    eventName: "Attested",
    enabled: Boolean(attestationRegistry),
    onLogs: () => invalidate(),
  });
  useWatchContractEvent({
    address: settlementEscrow,
    abi: settlementEscrowAbi,
    eventName: "Funded",
    enabled: Boolean(settlementEscrow),
    onLogs: () => invalidate(),
  });

  return {
    activity: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
