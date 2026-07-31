"use client";

import { useMemo } from "react";
import type { Address, Hex } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import { useContractLogs } from "./useContractLogs";

export interface RetirementItem {
  readonly account: Address;
  readonly projectId: bigint;
  readonly amount: bigint;
  readonly blockNumber: bigint;
  readonly transactionHash: Hex;
}

export interface OffsetItem {
  readonly batchId: Hex;
  readonly account: Address;
  readonly projectId: bigint;
  readonly amount: bigint;
  readonly blockNumber: bigint;
  readonly transactionHash: Hex;
}

/** Recent carbon-credit retirements (from CarbonCreditToken `Retired` logs). */
export function useRetirements() {
  const { logs, ...rest } = useContractLogs({ name: "CarbonCreditToken", eventName: "Retired" });
  const items = useMemo<RetirementItem[]>(
    () =>
      logs.map((log) => ({
        account: (log.args.account as Address) ?? "0x0000000000000000000000000000000000000000",
        projectId: toBig(log.args.projectId),
        amount: toBig(log.args.amount),
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      })),
    [logs],
  );
  return { items, ...rest };
}

/** Recent batch offsets (from OffsetMarketplace `Offset` logs). */
export function useOffsets() {
  const { logs, ...rest } = useContractLogs({ name: "OffsetMarketplace", eventName: "Offset" });
  const items = useMemo<OffsetItem[]>(
    () =>
      logs.map((log) => ({
        batchId: (log.args.batchId as Hex) ?? ("0x" as Hex),
        account: (log.args.account as Address) ?? "0x0000000000000000000000000000000000000000",
        projectId: toBig(log.args.projectId),
        amount: toBig(log.args.amount),
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      })),
    [logs],
  );
  return { items, ...rest };
}

/** Balances for a project id: the connected account's holdings + total retired. */
export function useCarbonProject(projectId?: bigint) {
  const { address: account } = useAccount();
  const carbon = tryContractRef("CarbonCreditToken");
  const offset = tryContractRef("OffsetMarketplace");
  const enabled = projectId !== undefined && Boolean(carbon);

  const balanceQuery = useReadContract({
    address: carbon?.address,
    abi: carbon?.abi,
    functionName: "balanceOf",
    args: account && projectId !== undefined ? [account, projectId] : undefined,
    query: { enabled: enabled && Boolean(account) },
  });

  const retiredQuery = useReadContract({
    address: carbon?.address,
    abi: carbon?.abi,
    functionName: "retiredOf",
    args: projectId !== undefined ? [projectId] : undefined,
    query: { enabled },
  });

  const approvedQuery = useReadContract({
    address: carbon?.address,
    abi: carbon?.abi,
    functionName: "isApprovedForAll",
    args: account && offset ? [account, offset.address] : undefined,
    query: { enabled: Boolean(carbon && offset && account) },
  });

  const refetch = () => {
    void balanceQuery.refetch();
    void retiredQuery.refetch();
    void approvedQuery.refetch();
  };

  return {
    balance: (balanceQuery.data as bigint | undefined) ?? 0n,
    retired: (retiredQuery.data as bigint | undefined) ?? 0n,
    approvedForOffset: Boolean(approvedQuery.data),
    isLoading: balanceQuery.isLoading,
    refetch,
  };
}

/** A batch's remaining un-offset footprint plus measured emissions. */
export function useFootprint(batchId?: Hex) {
  const offset = tryContractRef("OffsetMarketplace");
  const oracle = tryContractRef("SustainabilityOracle");
  const enabled = Boolean(batchId);

  const remainingQuery = useReadContract({
    address: offset?.address,
    abi: offset?.abi,
    functionName: "remainingFootprint",
    args: batchId ? [batchId] : undefined,
    query: { enabled: enabled && Boolean(offset) },
  });

  const emissionsQuery = useReadContract({
    address: oracle?.address,
    abi: oracle?.abi,
    functionName: "emissionsOf",
    args: batchId ? [batchId] : undefined,
    query: { enabled: enabled && Boolean(oracle) },
  });

  const refetch = () => {
    void remainingQuery.refetch();
    void emissionsQuery.refetch();
  };

  return {
    remaining: (remainingQuery.data as bigint | undefined) ?? undefined,
    emissions: (emissionsQuery.data as bigint | undefined) ?? undefined,
    isLoading: remainingQuery.isLoading,
    refetch,
  };
}

function toBig(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return 0n;
}
