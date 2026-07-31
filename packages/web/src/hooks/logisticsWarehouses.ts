"use client";

import { useMemo } from "react";
import type { Address, Hex } from "viem";
import { useReadContract } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import { useContractLogs } from "./useContractLogs";

/** A tokenized warehouse receipt (ERC-721) issued against a batch. */
export interface WarehouseReceiptItem {
  readonly tokenId: bigint;
  readonly batchId: Hex;
  readonly to: Address;
  readonly quantity: bigint;
  readonly location: string;
  readonly blockNumber: bigint;
  readonly transactionHash: Hex;
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as Address;
const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

/** All issued warehouse receipts (latest first) with their redeemed status. */
export function useWarehouseReceipts() {
  const issued = useContractLogs({ name: "WarehouseReceipt", eventName: "Issued" });
  const redeemed = useContractLogs({ name: "WarehouseReceipt", eventName: "Redeemed" });

  const redeemedIds = useMemo(() => {
    const set = new Set<string>();
    for (const log of redeemed.logs) {
      const id = log.args.tokenId;
      if (id !== undefined && id !== null) set.add(String(id));
    }
    return set;
  }, [redeemed.logs]);

  const receipts = useMemo<WarehouseReceiptItem[]>(
    () =>
      issued.logs.map((log) => ({
        tokenId: toBig(log.args.tokenId),
        batchId: (log.args.batchId as Hex) ?? ZERO_HASH,
        to: (log.args.to as Address) ?? ZERO_ADDR,
        quantity: toBig(log.args.quantity),
        location: String(log.args.location ?? ""),
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      })),
    [issued.logs],
  );

  return {
    receipts,
    isRedeemed: (tokenId: bigint) => redeemedIds.has(tokenId.toString()),
    isLoading: issued.isLoading,
    isError: issued.isError,
    error: issued.error,
    notDeployed: issued.notDeployed,
    refetch: () => {
      issued.refetch();
      redeemed.refetch();
    },
  };
}

export interface WarehouseReceiptDetail {
  readonly tokenId: bigint;
  readonly batchId: Hex;
  readonly quantity: bigint;
  readonly location: string;
  readonly redeemed: boolean;
}

interface RawReceipt {
  tokenId: bigint;
  batchId: Hex;
  quantity: bigint;
  location: string;
  redeemed: boolean;
}

/** On-chain state for a single receipt token: `receiptOf` + current owner. */
export function useWarehouseReceipt(tokenId?: bigint) {
  const ref = tryContractRef("WarehouseReceipt");
  const enabled = tokenId !== undefined && Boolean(ref);

  const receiptQuery = useReadContract({
    address: ref?.address,
    abi: ref?.abi,
    functionName: "receiptOf",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled },
  });

  const ownerQuery = useReadContract({
    address: ref?.address,
    abi: ref?.abi,
    functionName: "ownerOf",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled },
  });

  const raw = receiptQuery.data as RawReceipt | undefined;
  const receipt: WarehouseReceiptDetail | null =
    raw && raw.tokenId !== undefined
      ? {
          tokenId: raw.tokenId,
          batchId: raw.batchId,
          quantity: raw.quantity,
          location: raw.location,
          redeemed: raw.redeemed,
        }
      : null;

  return {
    receipt,
    owner: (ownerQuery.data as Address | undefined) ?? undefined,
    notDeployed: !ref,
    isLoading: receiptQuery.isLoading,
    isError: receiptQuery.isError,
    error: receiptQuery.error ?? null,
    refetch: () => {
      void receiptQuery.refetch();
      void ownerQuery.refetch();
    },
  };
}

function toBig(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return 0n;
}
