"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Abi, Address, Hex } from "viem";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { getAbi } from "@/lib/abis";
import { getResolvedAddress } from "@/lib/shared";
import { env } from "@/lib/env";
import { logOrder, reducePolicyEvents, type PolicyEvent, type PolicyRecord } from "@/lib/insurance";

const QUERY_KEY = "insurance-policies";
const ABI = getAbi("PolicyManager") as Abi;

/**
 * Indexes PolicyManager events into current policy records. When `holder` is
 * given, only that holder's policies are indexed (server-side indexed-arg
 * filter). Live via PolicyIssued/PolicyCancelled subscriptions.
 */
export function usePolicies(holder?: Address) {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const address = getResolvedAddress("PolicyManager");

  const query = useQuery<PolicyRecord[]>({
    queryKey: [QUERY_KEY, env.chainId, address, holder ?? "all"],
    enabled: Boolean(publicClient && address),
    queryFn: async () => {
      if (!publicClient || !address) return [];
      const fromBlock = env.deployBlock ?? "earliest";

      const [issued, cancelled] = await Promise.all([
        publicClient.getContractEvents({
          address,
          abi: ABI,
          eventName: "PolicyIssued",
          args: holder ? { holder } : undefined,
          fromBlock,
          toBlock: "latest",
        }),
        publicClient.getContractEvents({ address, abi: ABI, eventName: "PolicyCancelled", fromBlock, toBlock: "latest" }),
      ]);

      const issuedIds = new Set<Hex>();
      const events: PolicyEvent[] = [];
      for (const log of issued) {
        const a = log.args as { policyId?: Hex; batchId?: Hex; holder?: Address; coverage?: bigint; premium?: bigint };
        if (!a.policyId) continue;
        issuedIds.add(a.policyId);
        events.push({
          kind: "issued",
          policyId: a.policyId,
          order: logOrder(log.blockNumber, log.logIndex),
          batchId: a.batchId,
          holder: a.holder,
          coverage: a.coverage,
          premium: a.premium,
        });
      }
      for (const log of cancelled) {
        const a = log.args as { policyId?: Hex };
        // When filtering by holder, only fold cancellations for that holder's policies.
        if (!a.policyId || (holder && !issuedIds.has(a.policyId))) continue;
        events.push({ kind: "cancelled", policyId: a.policyId, order: logOrder(log.blockNumber, log.logIndex) });
      }

      return reducePolicyEvents(events);
    },
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [QUERY_KEY, env.chainId, address, holder ?? "all"] });
  }, [queryClient, address, holder]);

  useWatchContractEvent({ address, abi: ABI, eventName: "PolicyIssued", enabled: Boolean(address), onLogs: invalidate });
  useWatchContractEvent({ address, abi: ABI, eventName: "PolicyCancelled", enabled: Boolean(address), onLogs: invalidate });

  return {
    policies: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
