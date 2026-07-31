"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Hex } from "viem";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import {
  attestationRegistryAbi,
  provenanceRegistryAbi,
  settlementEscrowAbi,
} from "@/lib/abis";
import { contractAddresses } from "@/lib/shared";
import { env } from "@/lib/env";
import { formatBps, formatTokenAmount } from "@/lib/format";
import type { TimelineItem } from "@/lib/types";

const USDC_DECIMALS = 6;

/**
 * Builds the deal timeline (registered → checkpoints → attested →
 * settled/disputed/refunded) by reading the relevant events for a batch, with
 * explorer tx links. Live-updates on new events.
 */
export function useTimeline(batchId: Hex | undefined) {
  const client = usePublicClient();
  const queryClient = useQueryClient();
  const { provenanceRegistry, attestationRegistry, settlementEscrow } = contractAddresses;

  const query = useQuery<TimelineItem[]>({
    queryKey: ["timeline", env.chainId, batchId],
    enabled: Boolean(client && batchId),
    queryFn: async () => {
      if (!client || !batchId) return [];
      const fromBlock = env.deployBlock ?? "earliest";
      const items: (TimelineItem & { block: bigint; index: number })[] = [];

      // Fetch every contract's logs concurrently — these are independent RPC
      // calls, so awaiting them sequentially needlessly serialized the load.
      const [registered, checkpoints, attested, funded, released, disputed, refunded] =
        await Promise.all([
          provenanceRegistry
            ? client.getContractEvents({
                address: provenanceRegistry,
                abi: provenanceRegistryAbi,
                eventName: "BatchRegistered",
                args: { batchId },
                fromBlock,
                toBlock: "latest",
              })
            : [],
          provenanceRegistry
            ? client.getContractEvents({
                address: provenanceRegistry,
                abi: provenanceRegistryAbi,
                eventName: "CheckpointAdded",
                args: { batchId },
                fromBlock,
                toBlock: "latest",
              })
            : [],
          attestationRegistry
            ? client.getContractEvents({
                address: attestationRegistry,
                abi: attestationRegistryAbi,
                eventName: "Attested",
                args: { batchId },
                fromBlock,
                toBlock: "latest",
              })
            : [],
          settlementEscrow
            ? client.getContractEvents({
                address: settlementEscrow,
                abi: settlementEscrowAbi,
                eventName: "Funded",
                args: { batchId },
                fromBlock,
                toBlock: "latest",
              })
            : [],
          settlementEscrow
            ? client.getContractEvents({
                address: settlementEscrow,
                abi: settlementEscrowAbi,
                eventName: "Released",
                args: { batchId },
                fromBlock,
                toBlock: "latest",
              })
            : [],
          settlementEscrow
            ? client.getContractEvents({
                address: settlementEscrow,
                abi: settlementEscrowAbi,
                eventName: "Disputed",
                args: { batchId },
                fromBlock,
                toBlock: "latest",
              })
            : [],
          settlementEscrow
            ? client.getContractEvents({
                address: settlementEscrow,
                abi: settlementEscrowAbi,
                eventName: "Refunded",
                args: { batchId },
                fromBlock,
                toBlock: "latest",
              })
            : [],
        ]);

      for (const log of registered) {
        items.push({
          kind: "registered",
          title: "Batch registered",
          description: `Supplier ${log.args.supplier ?? ""}`,
          txHash: log.transactionHash ?? undefined,
          block: log.blockNumber ?? 0n,
          index: log.logIndex ?? 0,
        });
      }

      for (const log of checkpoints) {
        items.push({
          kind: "checkpoint",
          title: "Checkpoint added",
          description: log.args.location ?? undefined,
          timestamp: log.args.timestamp ? Number(log.args.timestamp) : undefined,
          txHash: log.transactionHash ?? undefined,
          block: log.blockNumber ?? 0n,
          index: log.logIndex ?? 0,
        });
      }

      for (const log of attested) {
        items.push({
          kind: "attested",
          title: "Attested by agent",
          description: log.args.score !== undefined ? `Score ${formatBps(log.args.score)}` : undefined,
          txHash: log.transactionHash ?? undefined,
          block: log.blockNumber ?? 0n,
          index: log.logIndex ?? 0,
        });
      }

      for (const log of funded) {
        items.push({
          kind: "funded",
          title: "Escrow funded",
          description:
            log.args.amount !== undefined
              ? `${formatTokenAmount(log.args.amount, USDC_DECIMALS)} tokens`
              : undefined,
          txHash: log.transactionHash ?? undefined,
          block: log.blockNumber ?? 0n,
          index: log.logIndex ?? 0,
        });
      }

      for (const log of released) {
        items.push({
          kind: "released",
          title: "Settled — funds released",
          description:
            log.args.amount !== undefined
              ? `${formatTokenAmount(log.args.amount, USDC_DECIMALS)} to supplier`
              : undefined,
          txHash: log.transactionHash ?? undefined,
          block: log.blockNumber ?? 0n,
          index: log.logIndex ?? 0,
        });
      }

      for (const log of disputed) {
        items.push({
          kind: "disputed",
          title: "Disputed — held for review",
          description: log.args.score !== undefined ? `Score ${formatBps(log.args.score)}` : undefined,
          txHash: log.transactionHash ?? undefined,
          block: log.blockNumber ?? 0n,
          index: log.logIndex ?? 0,
        });
      }

      for (const log of refunded) {
        items.push({
          kind: "refunded",
          title: "Refunded to buyer",
          description:
            log.args.amount !== undefined
              ? `${formatTokenAmount(log.args.amount, USDC_DECIMALS)} returned`
              : undefined,
          txHash: log.transactionHash ?? undefined,
          block: log.blockNumber ?? 0n,
          index: log.logIndex ?? 0,
        });
      }

      items.sort((a, b) => (a.block === b.block ? a.index - b.index : a.block < b.block ? -1 : 1));
      return items.map(({ block: _block, index: _index, ...item }) => {
        void _block;
        void _index;
        return item;
      });
    },
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["timeline", env.chainId, batchId] });
  }, [queryClient, batchId]);

  // Invalidate the timeline on EVERY lifecycle event, not just settlement
  // outcomes, so the card never goes stale after a fund/checkpoint/attestation.
  useWatchContractEvent({
    address: provenanceRegistry,
    abi: provenanceRegistryAbi,
    eventName: "BatchRegistered",
    args: batchId ? { batchId } : undefined,
    enabled: Boolean(provenanceRegistry && batchId),
    onLogs: () => invalidate(),
  });
  useWatchContractEvent({
    address: provenanceRegistry,
    abi: provenanceRegistryAbi,
    eventName: "CheckpointAdded",
    args: batchId ? { batchId } : undefined,
    enabled: Boolean(provenanceRegistry && batchId),
    onLogs: () => invalidate(),
  });
  useWatchContractEvent({
    address: attestationRegistry,
    abi: attestationRegistryAbi,
    eventName: "Attested",
    args: batchId ? { batchId } : undefined,
    enabled: Boolean(attestationRegistry && batchId),
    onLogs: () => invalidate(),
  });
  useWatchContractEvent({
    address: settlementEscrow,
    abi: settlementEscrowAbi,
    eventName: "Funded",
    args: batchId ? { batchId } : undefined,
    enabled: Boolean(settlementEscrow && batchId),
    onLogs: () => invalidate(),
  });
  useWatchContractEvent({
    address: settlementEscrow,
    abi: settlementEscrowAbi,
    eventName: "Released",
    args: batchId ? { batchId } : undefined,
    enabled: Boolean(settlementEscrow && batchId),
    onLogs: () => invalidate(),
  });
  useWatchContractEvent({
    address: settlementEscrow,
    abi: settlementEscrowAbi,
    eventName: "Disputed",
    args: batchId ? { batchId } : undefined,
    enabled: Boolean(settlementEscrow && batchId),
    onLogs: () => invalidate(),
  });
  useWatchContractEvent({
    address: settlementEscrow,
    abi: settlementEscrowAbi,
    eventName: "Refunded",
    args: batchId ? { batchId } : undefined,
    enabled: Boolean(settlementEscrow && batchId),
    onLogs: () => invalidate(),
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
