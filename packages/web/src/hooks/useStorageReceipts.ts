"use client";

import { useMemo } from "react";
import type { Address, Hex } from "viem";
import { useReadContracts } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import { useNftCollection, type NftItem } from "./useNfts";

/**
 * Warehouse (storage) receipts (WD §6 Markets → Storage). Enumerates live
 * `WarehouseReceipt` ERC721 tokens from their `Transfer` logs (via
 * `useNftCollection`) and enriches each with the on-chain `receiptOf` record —
 * stored quantity, location, and redemption state — in a single multicall.
 */

export interface StorageReceipt {
  readonly tokenId: bigint;
  readonly owner: Address;
  readonly batchId: Hex;
  readonly quantity: bigint;
  readonly location: string;
  readonly redeemed: boolean;
}

interface RawReceipt {
  readonly tokenId: bigint;
  readonly batchId: Hex;
  readonly quantity: bigint;
  readonly location: string;
  readonly redeemed: boolean;
}

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

export function useStorageReceipts() {
  const collection = useNftCollection("WarehouseReceipt");
  const ref = tryContractRef("WarehouseReceipt");
  const tokens: readonly NftItem[] = collection.items;

  const receiptsQuery = useReadContracts({
    contracts: ref
      ? tokens.map((token) => ({
          address: ref.address,
          abi: ref.abi,
          functionName: "receiptOf",
          args: [token.tokenId],
        }))
      : [],
    query: { enabled: Boolean(ref) && tokens.length > 0 },
  });

  const receipts = useMemo<StorageReceipt[]>(() => {
    const rows = receiptsQuery.data;
    return tokens.map((token, index) => {
      const result = rows?.[index];
      const raw = result?.status === "success" ? (result.result as RawReceipt) : undefined;
      return {
        tokenId: token.tokenId,
        owner: token.owner,
        batchId: raw?.batchId ?? ZERO_BYTES32,
        quantity: raw?.quantity ?? 0n,
        location: raw?.location ?? "",
        redeemed: raw?.redeemed ?? false,
      };
    });
  }, [tokens, receiptsQuery.data]);

  return {
    receipts,
    isLoading: collection.isLoading || (tokens.length > 0 && receiptsQuery.isLoading),
    isError: collection.isError,
    error: collection.error,
    notDeployed: collection.notDeployed,
    refetch: () => {
      collection.refetch();
      void receiptsQuery.refetch();
    },
  };
}
