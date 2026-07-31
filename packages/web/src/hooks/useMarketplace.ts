"use client";

import { useMemo } from "react";
import type { Address, Hex } from "viem";
import { useReadContract } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import { useContractLogs } from "./useContractLogs";

export const AssetKind = { Unknown: 0, Receivable: 1, ERC721: 2, ERC1155: 3 } as const;
export const ASSET_KIND_LABEL: Record<number, string> = {
  0: "Unknown",
  1: "Receivable",
  2: "ERC721",
  3: "ERC1155",
};

export const ListingStatus = { None: 0, Active: 1, Cancelled: 2, Filled: 3 } as const;
export const LISTING_STATUS_LABEL: Record<number, string> = {
  0: "None",
  1: "Active",
  2: "Cancelled",
  3: "Filled",
};

export const OrderSide = { Buy: 0, Sell: 1 } as const;

export interface ListingEvent {
  readonly listingId: bigint;
  readonly seller: Address;
  readonly kind: number;
  readonly asset: Address;
  readonly assetId: bigint;
  readonly price: bigint;
}

export interface OrderEvent {
  readonly orderId: bigint;
  readonly side: number;
  readonly maker: Address;
  readonly asset: Address;
  readonly price: bigint;
  readonly quantity: bigint;
}

/** Enumerate listings from ListingRegistry `ListingCreated` logs (latest first). */
export function useListings() {
  const { logs, ...rest } = useContractLogs({ name: "ListingRegistry", eventName: "ListingCreated" });
  const listings = useMemo<ListingEvent[]>(() => {
    const seen = new Set<string>();
    const out: ListingEvent[] = [];
    for (const log of logs) {
      const id = log.args.listingId;
      if (id === undefined || id === null || seen.has(String(id))) continue;
      seen.add(String(id));
      out.push({
        listingId: toBig(id),
        seller: (log.args.seller as Address) ?? ZERO,
        kind: Number(log.args.kind ?? 0),
        asset: (log.args.asset as Address) ?? ZERO,
        assetId: toBig(log.args.assetId),
        price: toBig(log.args.price),
      });
    }
    return out;
  }, [logs]);
  return { listings, ...rest };
}

/** Live status of a single listing (reads `listingOf`). */
export function useListingStatus(listingId: bigint) {
  const ref = tryContractRef("ListingRegistry");
  const query = useReadContract({
    address: ref?.address,
    abi: ref?.abi,
    functionName: "listingOf",
    args: [listingId],
    query: { enabled: Boolean(ref) },
  });
  const raw = query.data as { status?: number; seller?: Address } | undefined;
  return { status: raw?.status ?? undefined, seller: raw?.seller, refetch: () => void query.refetch() };
}

/** Enumerate limit orders from OrderBook `OrderPlaced` logs (latest first). */
export function useOrders() {
  const { logs, ...rest } = useContractLogs({ name: "OrderBook", eventName: "OrderPlaced" });
  const orders = useMemo<OrderEvent[]>(() => {
    const seen = new Set<string>();
    const out: OrderEvent[] = [];
    for (const log of logs) {
      const id = log.args.orderId;
      if (id === undefined || id === null || seen.has(String(id))) continue;
      seen.add(String(id));
      out.push({
        orderId: toBig(id),
        side: Number(log.args.side ?? 0),
        maker: (log.args.maker as Address) ?? ZERO,
        asset: (log.args.asset as Address) ?? ZERO,
        price: toBig(log.args.price),
        quantity: toBig(log.args.quantity),
      });
    }
    return out;
  }, [logs]);
  return { orders, ...rest };
}

const ZERO: Address = "0x0000000000000000000000000000000000000000";

function toBig(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return 0n;
}

export type { Hex };
