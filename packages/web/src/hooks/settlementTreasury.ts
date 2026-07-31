"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Abi, Address, Hex } from "viem";
import { getAddress } from "viem";
import { usePublicClient, useReadContracts, useWatchContractEvent } from "wagmi";
import { getAbi } from "@/lib/abis";
import { getResolvedAddress } from "@/lib/shared";
import { env } from "@/lib/env";
import { logOrder } from "@/lib/finance";

const TREASURY_ABI = getAbi("Treasury") as Abi;

export type TreasuryFlowKind = "deposit" | "withdraw";

/** A single treasury movement decoded from a Deposit/Withdraw event. */
export interface TreasuryFlow {
  readonly kind: TreasuryFlowKind;
  readonly counterparty?: Address;
  readonly token?: Address;
  readonly amount: bigint;
  readonly blockNumber?: bigint;
  readonly txHash?: Hex;
  readonly order: bigint;
}

/** Current accounted balance of a single token held by the treasury. */
export interface TreasuryBalance {
  readonly token: Address;
  readonly balance: bigint;
}

const QUERY_KEY = "treasury-flows";

/**
 * Reads the on-chain Treasury: indexes `Deposit` / `Withdraw` events into a
 * movement feed, derives the set of tokens ever seen, and reads each token's
 * current accounted `balanceOf` from the contract. Stays live via event
 * subscriptions.
 */
export function useTreasury() {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const treasury = getResolvedAddress("Treasury");

  const flowsQuery = useQuery<TreasuryFlow[]>({
    queryKey: [QUERY_KEY, env.chainId, treasury],
    enabled: Boolean(publicClient && treasury),
    queryFn: async () => {
      if (!publicClient || !treasury) return [];
      const fromBlock = env.deployBlock ?? "earliest";
      const [deposits, withdrawals] = await Promise.all(
        (["Deposit", "Withdraw"] as const).map((eventName) =>
          publicClient.getContractEvents({ address: treasury, abi: TREASURY_ABI, eventName, fromBlock, toBlock: "latest" }),
        ),
      );
      const rows: TreasuryFlow[] = [];
      for (const log of deposits) {
        const a = log.args as { from?: Address; token?: Address; amount?: bigint };
        rows.push({
          kind: "deposit",
          counterparty: a.from,
          token: a.token,
          amount: a.amount ?? 0n,
          blockNumber: log.blockNumber ?? undefined,
          txHash: log.transactionHash ?? undefined,
          order: logOrder(log.blockNumber, log.logIndex),
        });
      }
      for (const log of withdrawals) {
        const a = log.args as { to?: Address; token?: Address; amount?: bigint };
        rows.push({
          kind: "withdraw",
          counterparty: a.to,
          token: a.token,
          amount: a.amount ?? 0n,
          blockNumber: log.blockNumber ?? undefined,
          txHash: log.transactionHash ?? undefined,
          order: logOrder(log.blockNumber, log.logIndex),
        });
      }
      return rows.sort((x, y) => (x.order > y.order ? -1 : x.order < y.order ? 1 : 0));
    },
  });

  const flows = useMemo(() => flowsQuery.data ?? [], [flowsQuery.data]);

  const tokens = useMemo(() => {
    const set = new Set<Address>();
    for (const f of flows) if (f.token) set.add(getAddress(f.token));
    return [...set];
  }, [flows]);

  const balancesQuery = useReadContracts({
    contracts: treasury
      ? tokens.map((token) => ({
          address: treasury,
          abi: TREASURY_ABI,
          functionName: "balanceOf" as const,
          args: [token] as const,
        }))
      : [],
    query: { enabled: Boolean(treasury) && tokens.length > 0 },
  });

  const balances = useMemo<TreasuryBalance[]>(() => {
    const rows = balancesQuery.data;
    if (!rows) return [];
    return tokens.map((token, i) => ({
      token,
      balance: rows[i]?.status === "success" ? ((rows[i]?.result as bigint | undefined) ?? 0n) : 0n,
    }));
  }, [balancesQuery.data, tokens]);

  const refetch = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [QUERY_KEY, env.chainId, treasury] });
    void balancesQuery.refetch();
  }, [queryClient, treasury, balancesQuery]);

  useWatchContractEvent({ address: treasury, abi: TREASURY_ABI, eventName: "Deposit", enabled: Boolean(treasury), onLogs: refetch });
  useWatchContractEvent({ address: treasury, abi: TREASURY_ABI, eventName: "Withdraw", enabled: Boolean(treasury), onLogs: refetch });

  return {
    treasuryAddress: treasury,
    flows,
    balances,
    tokens,
    isLoading: flowsQuery.isLoading,
    isError: flowsQuery.isError,
    error: flowsQuery.error,
    refetch,
    deployed: Boolean(treasury),
  };
}
