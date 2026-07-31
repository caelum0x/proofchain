"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Abi, Address, Hex } from "viem";
import { usePublicClient, useReadContracts, useWatchContractEvent } from "wagmi";
import { getAbi } from "@/lib/abis";
import { getResolvedAddress } from "@/lib/shared";
import { env } from "@/lib/env";
import { logOrder } from "@/lib/finance";

const FEE_ABI = getAbi("FeeManager") as Abi;

/** A single collected fee, decoded from a FeeManager `FeeCollected` event. */
export interface FeeCollection {
  readonly action: Hex;
  readonly token?: Address;
  readonly payer?: Address;
  readonly amount: bigint;
  readonly blockNumber?: bigint;
  readonly txHash?: Hex;
  readonly order: bigint;
}

/** A configured fee rate for an action key (basis points). */
export interface FeeRate {
  readonly action: Hex;
  readonly bps: number;
}

const QUERY_KEY = "fee-manager";

/**
 * Reads the FeeManager schedule + collections: indexes `FeeCollected` and
 * `FeeBpsSet` events, derives the distinct action keys, and reads each key's
 * current `feeBps`. Stays live via event subscriptions.
 */
export function useFeeSchedule() {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const feeManager = getResolvedAddress("FeeManager");

  const eventsQuery = useQuery<{ collections: FeeCollection[]; actions: Hex[] }>({
    queryKey: [QUERY_KEY, env.chainId, feeManager],
    enabled: Boolean(publicClient && feeManager),
    queryFn: async () => {
      if (!publicClient || !feeManager) return { collections: [], actions: [] };
      const fromBlock = env.deployBlock ?? "earliest";
      const [collected, bpsSet] = await Promise.all(
        (["FeeCollected", "FeeBpsSet"] as const).map((eventName) =>
          publicClient.getContractEvents({ address: feeManager, abi: FEE_ABI, eventName, fromBlock, toBlock: "latest" }),
        ),
      );

      const actionSet = new Set<Hex>();
      const collections: FeeCollection[] = [];
      for (const log of collected) {
        const a = log.args as { action?: Hex; token?: Address; payer?: Address; amount?: bigint };
        if (!a.action) continue;
        actionSet.add(a.action);
        collections.push({
          action: a.action,
          token: a.token,
          payer: a.payer,
          amount: a.amount ?? 0n,
          blockNumber: log.blockNumber ?? undefined,
          txHash: log.transactionHash ?? undefined,
          order: logOrder(log.blockNumber, log.logIndex),
        });
      }
      for (const log of bpsSet) {
        const a = log.args as { action?: Hex };
        if (a.action) actionSet.add(a.action);
      }
      collections.sort((x, y) => (x.order > y.order ? -1 : x.order < y.order ? 1 : 0));
      return { collections, actions: [...actionSet] };
    },
  });

  const actions = useMemo(() => eventsQuery.data?.actions ?? [], [eventsQuery.data]);

  const ratesQuery = useReadContracts({
    contracts: feeManager
      ? actions.map((action) => ({
          address: feeManager,
          abi: FEE_ABI,
          functionName: "feeBps" as const,
          args: [action] as const,
        }))
      : [],
    query: { enabled: Boolean(feeManager) && actions.length > 0 },
  });

  const rates = useMemo<FeeRate[]>(() => {
    const rows = ratesQuery.data;
    if (!rows) return [];
    return actions.map((action, i) => ({
      action,
      bps: rows[i]?.status === "success" ? Number((rows[i]?.result as number | undefined) ?? 0) : 0,
    }));
  }, [ratesQuery.data, actions]);

  const refetch = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [QUERY_KEY, env.chainId, feeManager] });
    void ratesQuery.refetch();
  }, [queryClient, feeManager, ratesQuery]);

  useWatchContractEvent({ address: feeManager, abi: FEE_ABI, eventName: "FeeCollected", enabled: Boolean(feeManager), onLogs: refetch });
  useWatchContractEvent({ address: feeManager, abi: FEE_ABI, eventName: "FeeBpsSet", enabled: Boolean(feeManager), onLogs: refetch });

  return {
    feeManagerAddress: feeManager,
    collections: eventsQuery.data?.collections ?? [],
    rates,
    isLoading: eventsQuery.isLoading,
    isError: eventsQuery.isError,
    error: eventsQuery.error,
    refetch,
    deployed: Boolean(feeManager),
  };
}
