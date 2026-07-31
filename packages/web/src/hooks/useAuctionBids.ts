"use client";

import { useMemo } from "react";
import type { Address } from "viem";
import { useContractLogs } from "./useContractLogs";

export interface AuctionBid {
  readonly bidder: Address;
  readonly amount: bigint;
  readonly blockNumber: bigint;
  readonly key: string;
}

/**
 * Bid history for a single auction, read from AuctionHouse `Bid` logs and
 * filtered to the given auction id. Newest-first (as delivered by the log
 * scanner). Live via the shared event subscription.
 */
export function useAuctionBids(auctionId?: bigint) {
  const { logs, isLoading, isError, error, refetch, notDeployed } = useContractLogs({
    name: "AuctionHouse",
    eventName: "Bid",
    enabled: auctionId !== undefined,
  });

  const bids = useMemo<AuctionBid[]>(() => {
    if (auctionId === undefined) return [];
    const out: AuctionBid[] = [];
    for (const log of logs) {
      const raw = log.args.auctionId;
      if (raw === undefined || raw === null) continue;
      if (String(raw) !== auctionId.toString()) continue;
      out.push({
        bidder: (log.args.bidder as Address) ?? ("0x0000000000000000000000000000000000000000" as Address),
        amount: typeof log.args.amount === "bigint" ? log.args.amount : BigInt(String(log.args.amount ?? 0)),
        blockNumber: log.blockNumber,
        key: `${log.transactionHash}-${log.logIndex}`,
      });
    }
    return out;
  }, [logs, auctionId]);

  return { bids, isLoading, isError, error, refetch, notDeployed };
}
