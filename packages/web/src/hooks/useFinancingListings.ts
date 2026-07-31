"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Abi, Address, Hex } from "viem";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { getAbi } from "@/lib/abis";
import { getResolvedAddress } from "@/lib/shared";
import { env } from "@/lib/env";
import {
  logOrder,
  reduceListingEvents,
  type FinancingListingRecord,
  type ListingEvent,
} from "@/lib/finance";

const QUERY_KEY = "financing-listings";
const ABI = getAbi("InvoiceFinancing") as Abi;

/**
 * Discovers every invoice-financing listing by reading InvoiceFinancing events
 * (`Listed`/`Funded`/`Claimed`/`Cancelled`) and folding them into the current
 * state per batch. The contract exposes no enumeration, so — as with batches —
 * event indexing is the source of truth. Stays live via event subscriptions.
 */
export function useFinancingListings() {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const address = getResolvedAddress("InvoiceFinancing");

  const query = useQuery<FinancingListingRecord[]>({
    queryKey: [QUERY_KEY, env.chainId, address],
    enabled: Boolean(publicClient && address),
    queryFn: async () => {
      if (!publicClient || !address) return [];
      const fromBlock = env.deployBlock ?? "earliest";

      const [listed, funded, claimed, cancelled] = await Promise.all(
        (["Listed", "Funded", "Claimed", "Cancelled"] as const).map((eventName) =>
          publicClient.getContractEvents({ address, abi: ABI, eventName, fromBlock, toBlock: "latest" }),
        ),
      );

      const events: ListingEvent[] = [];
      for (const log of listed) {
        const a = log.args as { batchId?: Hex; supplier?: Address; token?: Address; askAmount?: bigint };
        if (!a.batchId) continue;
        events.push({
          kind: "listed",
          batchId: a.batchId,
          order: logOrder(log.blockNumber, log.logIndex),
          supplier: a.supplier,
          token: a.token,
          askAmount: a.askAmount,
        });
      }
      for (const log of funded) {
        const a = log.args as { batchId?: Hex; lender?: Address };
        if (!a.batchId) continue;
        events.push({ kind: "funded", batchId: a.batchId, order: logOrder(log.blockNumber, log.logIndex), lender: a.lender });
      }
      for (const log of claimed) {
        const a = log.args as { batchId?: Hex };
        if (!a.batchId) continue;
        events.push({ kind: "claimed", batchId: a.batchId, order: logOrder(log.blockNumber, log.logIndex) });
      }
      for (const log of cancelled) {
        const a = log.args as { batchId?: Hex };
        if (!a.batchId) continue;
        events.push({ kind: "cancelled", batchId: a.batchId, order: logOrder(log.blockNumber, log.logIndex) });
      }

      return reduceListingEvents(events);
    },
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [QUERY_KEY, env.chainId, address] });
  }, [queryClient, address]);

  useWatchContractEvent({ address, abi: ABI, eventName: "Listed", enabled: Boolean(address), onLogs: invalidate });
  useWatchContractEvent({ address, abi: ABI, eventName: "Funded", enabled: Boolean(address), onLogs: invalidate });
  useWatchContractEvent({ address, abi: ABI, eventName: "Claimed", enabled: Boolean(address), onLogs: invalidate });
  useWatchContractEvent({ address, abi: ABI, eventName: "Cancelled", enabled: Boolean(address), onLogs: invalidate });

  return {
    listings: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
