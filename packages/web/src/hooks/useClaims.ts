"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Abi, Address, Hex } from "viem";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { getAbi } from "@/lib/abis";
import { getResolvedAddress } from "@/lib/shared";
import { env } from "@/lib/env";
import { logOrder, reduceClaimEvents, type ClaimEvent, type ClaimRecord } from "@/lib/insurance";

const QUERY_KEY = "insurance-claims";
const ABI = getAbi("ClaimsProcessor") as Abi;

/**
 * Indexes ClaimsProcessor events into current claim records. When `claimant` is
 * given, only that account's claims are indexed. Live via the four claim
 * lifecycle event subscriptions.
 */
export function useClaims(claimant?: Address) {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const address = getResolvedAddress("ClaimsProcessor");

  const query = useQuery<ClaimRecord[]>({
    queryKey: [QUERY_KEY, env.chainId, address, claimant ?? "all"],
    enabled: Boolean(publicClient && address),
    queryFn: async () => {
      if (!publicClient || !address) return [];
      const fromBlock = env.deployBlock ?? "earliest";

      const [filed, approved, rejected, paid] = await Promise.all([
        publicClient.getContractEvents({
          address,
          abi: ABI,
          eventName: "ClaimFiled",
          args: claimant ? { claimant } : undefined,
          fromBlock,
          toBlock: "latest",
        }),
        publicClient.getContractEvents({ address, abi: ABI, eventName: "ClaimApproved", fromBlock, toBlock: "latest" }),
        publicClient.getContractEvents({ address, abi: ABI, eventName: "ClaimRejected", fromBlock, toBlock: "latest" }),
        publicClient.getContractEvents({ address, abi: ABI, eventName: "ClaimPaid", fromBlock, toBlock: "latest" }),
      ]);

      const filedIds = new Set<Hex>();
      const events: ClaimEvent[] = [];
      for (const log of filed) {
        const a = log.args as { claimId?: Hex; policyId?: Hex; claimant?: Address; amount?: bigint };
        if (!a.claimId) continue;
        filedIds.add(a.claimId);
        events.push({
          kind: "filed",
          claimId: a.claimId,
          order: logOrder(log.blockNumber, log.logIndex),
          policyId: a.policyId,
          claimant: a.claimant,
          amount: a.amount,
        });
      }
      type LifecycleLog = {
        readonly args: unknown;
        readonly blockNumber: bigint | null;
        readonly logIndex: number | null;
      };
      const foldLifecycle = (logs: readonly LifecycleLog[], kind: "approved" | "rejected" | "paid") => {
        for (const log of logs) {
          const a = log.args as { claimId?: Hex };
          if (!a.claimId || (claimant && !filedIds.has(a.claimId))) continue;
          events.push({ kind, claimId: a.claimId, order: logOrder(log.blockNumber, log.logIndex) });
        }
      };
      foldLifecycle(approved, "approved");
      foldLifecycle(rejected, "rejected");
      foldLifecycle(paid, "paid");

      return reduceClaimEvents(events);
    },
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [QUERY_KEY, env.chainId, address, claimant ?? "all"] });
  }, [queryClient, address, claimant]);

  useWatchContractEvent({ address, abi: ABI, eventName: "ClaimFiled", enabled: Boolean(address), onLogs: invalidate });
  useWatchContractEvent({ address, abi: ABI, eventName: "ClaimApproved", enabled: Boolean(address), onLogs: invalidate });
  useWatchContractEvent({ address, abi: ABI, eventName: "ClaimRejected", enabled: Boolean(address), onLogs: invalidate });
  useWatchContractEvent({ address, abi: ABI, eventName: "ClaimPaid", enabled: Boolean(address), onLogs: invalidate });

  return {
    claims: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
