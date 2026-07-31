"use client";

import { useMemo } from "react";
import type { Address } from "viem";
import { useReadContract } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import { useContractLogs } from "./useContractLogs";

export const AuctionState = { None: 0, Active: 1, Settled: 2, Cancelled: 3 } as const;
export const AUCTION_STATE_LABEL: Record<number, string> = {
  0: "None",
  1: "Active",
  2: "Settled",
  3: "Cancelled",
};

export interface AuctionStartedItem {
  readonly auctionId: bigint;
  readonly nft: Address;
  readonly tokenId: bigint;
  readonly seller: Address;
  readonly endTime: number;
}

/** Enumerate auctions from AuctionHouse `AuctionStarted` logs (latest first). */
export function useAuctions() {
  const { logs, ...rest } = useContractLogs({ name: "AuctionHouse", eventName: "AuctionStarted" });
  const auctions = useMemo<AuctionStartedItem[]>(() => {
    const seen = new Set<string>();
    const out: AuctionStartedItem[] = [];
    for (const log of logs) {
      const id = log.args.auctionId;
      if (id === undefined || id === null || seen.has(String(id))) continue;
      seen.add(String(id));
      out.push({
        auctionId: toBig(id),
        nft: (log.args.nft as Address) ?? ZERO,
        tokenId: toBig(log.args.tokenId),
        seller: (log.args.seller as Address) ?? ZERO,
        endTime: Number(log.args.endTime ?? 0),
      });
    }
    return out;
  }, [logs]);
  return { auctions, ...rest };
}

interface RawAuction {
  auctionId: bigint;
  nft: Address;
  tokenId: bigint;
  seller: Address;
  paymentToken: Address;
  reservePrice: bigint;
  highestBid: bigint;
  highestBidder: Address;
  endTime: bigint;
  state: number;
}

export interface AuctionDetail {
  readonly auctionId: bigint;
  readonly nft: Address;
  readonly tokenId: bigint;
  readonly seller: Address;
  readonly paymentToken: Address;
  readonly reservePrice: bigint;
  readonly highestBid: bigint;
  readonly highestBidder: Address;
  readonly endTime: number;
  readonly state: number;
}

/** Live state for a single auction (reads `auctionOf`). */
export function useAuction(auctionId?: bigint) {
  const ref = tryContractRef("AuctionHouse");
  const query = useReadContract({
    address: ref?.address,
    abi: ref?.abi,
    functionName: "auctionOf",
    args: auctionId !== undefined ? [auctionId] : undefined,
    query: { enabled: Boolean(ref) && auctionId !== undefined },
  });

  const raw = query.data as RawAuction | undefined;
  const auction: AuctionDetail | null = raw
    ? {
        auctionId: raw.auctionId,
        nft: raw.nft,
        tokenId: raw.tokenId,
        seller: raw.seller,
        paymentToken: raw.paymentToken,
        reservePrice: raw.reservePrice,
        highestBid: raw.highestBid,
        highestBidder: raw.highestBidder,
        endTime: Number(raw.endTime),
        state: raw.state,
      }
    : null;

  return {
    auction,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    refetch: () => void query.refetch(),
  };
}

const ZERO: Address = "0x0000000000000000000000000000000000000000";

function toBig(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return 0n;
}
