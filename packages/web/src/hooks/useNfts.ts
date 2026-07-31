"use client";

import { useMemo } from "react";
import type { Address, Hex } from "viem";
import { useReadContract } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import type { ContractName } from "@/lib/contract-names";
import { useContractLogs, type DecodedLog } from "./useContractLogs";

const ZERO = "0x0000000000000000000000000000000000000000";

/** The tokenized-asset collections surfaced on the NFT pages. */
export const NFT_COLLECTIONS = [
  { name: "BatchNFT" as ContractName, label: "Batch title", description: "Tokenized bill of lading minted on registration." },
  { name: "InvoiceNFT" as ContractName, label: "Receivable", description: "Receivable NFT minted per funded + attested deal." },
  { name: "WarehouseReceipt" as ContractName, label: "Warehouse receipt", description: "Stored-goods receipt with quantity and location." },
] as const;

export type NftCollectionName = (typeof NFT_COLLECTIONS)[number]["name"];

export function isNftCollection(value: string): value is NftCollectionName {
  return NFT_COLLECTIONS.some((c) => c.name === value);
}

export interface NftItem {
  readonly collection: NftCollectionName;
  readonly tokenId: bigint;
  readonly owner: Address;
}

/**
 * Pure reducer: given `Transfer` logs ordered most-recent-first, derive the live
 * token set for a collection. The first sighting of a tokenId is its latest
 * transfer (current owner); burns (to the zero address) are excluded, and an
 * optional `owner` filter narrows to a single holder. Exported for unit testing.
 */
export function reduceNftOwners(
  logs: readonly DecodedLog[],
  collection: NftCollectionName,
  owner?: Address,
): NftItem[] {
  const latest = new Map<string, Address>();
  for (const log of logs) {
    const tokenId = log.args.tokenId;
    if (tokenId === undefined || tokenId === null) continue;
    const key = String(tokenId);
    if (latest.has(key)) continue; // first (most-recent) wins
    latest.set(key, (log.args.to as Address) ?? (ZERO as Address));
  }
  const out: NftItem[] = [];
  for (const [key, ownerOf] of latest) {
    if (ownerOf === ZERO) continue; // burned
    if (owner && ownerOf.toLowerCase() !== owner.toLowerCase()) continue;
    out.push({ collection, tokenId: BigInt(key), owner: ownerOf });
  }
  // Highest tokenId first (roughly newest).
  out.sort((a, b) => (a.tokenId > b.tokenId ? -1 : a.tokenId < b.tokenId ? 1 : 0));
  return out;
}

/**
 * Enumerate the live tokens of an ERC721 collection from its `Transfer` logs.
 * Since logs arrive most-recent-first, the first sighting of a tokenId is its
 * latest transfer — that determines the current owner. Tokens burned (transferred
 * to the zero address) are excluded.
 */
export function useNftCollection(collection: NftCollectionName, owner?: Address) {
  const { logs, isLoading, isError, error, refetch, notDeployed } = useContractLogs({
    name: collection,
    eventName: "Transfer",
  });

  const items = useMemo<NftItem[]>(
    () => reduceNftOwners(logs, collection, owner),
    [logs, collection, owner],
  );

  return { items, isLoading, isError, error, refetch, notDeployed };
}

interface RawReceipt {
  tokenId: bigint;
  batchId: Hex;
  quantity: bigint;
  location: string;
  redeemed: boolean;
}

export interface ReceiptData {
  readonly tokenId: bigint;
  readonly batchId: Hex;
  readonly quantity: bigint;
  readonly location: string;
  readonly redeemed: boolean;
}

/** Read a single token's owner, metadata URI, and collection-specific extras. */
export function useNft(collection: NftCollectionName | undefined, tokenId: bigint | undefined) {
  const ref = collection ? tryContractRef(collection) : undefined;
  const enabled = Boolean(ref && tokenId !== undefined);

  const ownerQuery = useReadContract({
    address: ref?.address,
    abi: ref?.abi,
    functionName: "ownerOf",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled },
  });

  const uriQuery = useReadContract({
    address: ref?.address,
    abi: ref?.abi,
    functionName: "tokenURI",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled },
  });

  const receiptQuery = useReadContract({
    address: ref?.address,
    abi: ref?.abi,
    functionName: "receiptOf",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: enabled && collection === "WarehouseReceipt" },
  });

  const batchIdQuery = useReadContract({
    address: ref?.address,
    abi: ref?.abi,
    functionName: "batchIdOf",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: enabled && collection === "InvoiceNFT" },
  });

  const rawReceipt = receiptQuery.data as RawReceipt | undefined;
  const receipt: ReceiptData | undefined = rawReceipt
    ? {
        tokenId: rawReceipt.tokenId,
        batchId: rawReceipt.batchId,
        quantity: rawReceipt.quantity,
        location: rawReceipt.location,
        redeemed: rawReceipt.redeemed,
      }
    : undefined;

  const refetch = () => {
    void ownerQuery.refetch();
    void receiptQuery.refetch();
  };

  return {
    owner: ownerQuery.data as Address | undefined,
    tokenURI: (uriQuery.data as string | undefined) ?? "",
    receipt,
    batchId: (batchIdQuery.data as Hex | undefined) ?? (receipt?.batchId as Hex | undefined),
    exists: !ownerQuery.isError,
    isLoading: ownerQuery.isLoading,
    isError: ownerQuery.isError,
    error: ownerQuery.error ?? null,
    refetch,
  };
}
