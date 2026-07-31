"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Abi, Address, Hex } from "viem";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { getAbi } from "@/lib/abis";
import { getResolvedAddress } from "@/lib/shared";
import { env } from "@/lib/env";
import { logOrder } from "@/lib/finance";

const ROUTER_ABI = getAbi("PaymentRouter") as Abi;

/** A single routed payment, decoded from a PaymentRouter `Routed` event. */
export interface PaymentRecord {
  readonly action: Hex;
  readonly token?: Address;
  readonly payer?: Address;
  readonly destination?: Address;
  readonly amount: bigint;
  readonly fee: bigint;
  readonly blockNumber?: bigint;
  readonly txHash?: Hex;
  readonly order: bigint;
}

const QUERY_KEY = "payment-router-activity";

/**
 * Indexes PaymentRouter `Routed` events into a reverse-chronological payment
 * feed: which action key, token, payer, destination, gross amount and protocol
 * fee. Stays live via event subscription.
 */
export function usePaymentActivity() {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const router = getResolvedAddress("PaymentRouter");

  const query = useQuery<PaymentRecord[]>({
    queryKey: [QUERY_KEY, env.chainId, router],
    enabled: Boolean(publicClient && router),
    queryFn: async () => {
      if (!publicClient || !router) return [];
      const logs = await publicClient.getContractEvents({
        address: router,
        abi: ROUTER_ABI,
        eventName: "Routed",
        fromBlock: env.deployBlock ?? "earliest",
        toBlock: "latest",
      });
      const rows: PaymentRecord[] = [];
      for (const log of logs) {
        const a = log.args as {
          action?: Hex;
          token?: Address;
          payer?: Address;
          destination?: Address;
          amount?: bigint;
          fee?: bigint;
        };
        if (!a.action) continue;
        rows.push({
          action: a.action,
          token: a.token,
          payer: a.payer,
          destination: a.destination,
          amount: a.amount ?? 0n,
          fee: a.fee ?? 0n,
          blockNumber: log.blockNumber ?? undefined,
          txHash: log.transactionHash ?? undefined,
          order: logOrder(log.blockNumber, log.logIndex),
        });
      }
      return rows.sort((x, y) => (x.order > y.order ? -1 : x.order < y.order ? 1 : 0));
    },
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [QUERY_KEY, env.chainId, router] });
  }, [queryClient, router]);

  useWatchContractEvent({ address: router, abi: ROUTER_ABI, eventName: "Routed", enabled: Boolean(router), onLogs: invalidate });

  return {
    payments: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    deployed: Boolean(router),
  };
}
