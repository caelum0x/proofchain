"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Abi, Address, Hex } from "viem";
import { getAddress } from "viem";
import { usePublicClient, useReadContract, useReadContracts, useWatchContractEvent } from "wagmi";
import { getAbi } from "@/lib/abis";
import { getResolvedAddress } from "@/lib/shared";
import { env } from "@/lib/env";
import { logOrder } from "@/lib/finance";

const BOND_ABI = getAbi("SupplierBond") as Abi;

export type BondEventKind = "deposited" | "locked" | "unlocked" | "slashed" | "withdrawn";

/** A single supplier-bond movement, decoded from a lifecycle event. */
export interface BondEvent {
  readonly kind: BondEventKind;
  readonly supplier: Address;
  readonly token?: Address;
  readonly amount: bigint;
  readonly to?: Address;
  readonly blockNumber?: bigint;
  readonly txHash?: Hex;
  readonly order: bigint;
}

/** Current bond position for one supplier: total posted, locked, and free. */
export interface BondPosition {
  readonly supplier: Address;
  readonly total: bigint;
  readonly locked: bigint;
  readonly unlocked: bigint;
}

const QUERY_KEY = "supplier-bonds";

/**
 * Indexes SupplierBond lifecycle events, derives the distinct suppliers, and
 * reads each supplier's current `bondOf` / `lockedOf` / `unlockedOf`. Stays live
 * via event subscriptions.
 */
export function useSupplierBonds() {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const bond = getResolvedAddress("SupplierBond");

  const eventsQuery = useQuery<BondEvent[]>({
    queryKey: [QUERY_KEY, env.chainId, bond],
    enabled: Boolean(publicClient && bond),
    queryFn: async () => {
      if (!publicClient || !bond) return [];
      const fromBlock = env.deployBlock ?? "earliest";
      const [dep, lock, unlock, slash, wd] = await Promise.all(
        (["BondDeposited", "BondLocked", "BondUnlocked", "BondSlashed", "BondWithdrawn"] as const).map(
          (eventName) => publicClient.getContractEvents({ address: bond, abi: BOND_ABI, eventName, fromBlock, toBlock: "latest" }),
        ),
      );
      const rows: BondEvent[] = [];
      const push = (kind: BondEventKind, log: { args: unknown; blockNumber: bigint | null; logIndex: number | null; transactionHash: Hex | null }) => {
        const a = log.args as { supplier?: Address; token?: Address; amount?: bigint; to?: Address };
        if (!a.supplier) return;
        rows.push({
          kind,
          supplier: a.supplier,
          token: a.token,
          amount: a.amount ?? 0n,
          to: a.to,
          blockNumber: log.blockNumber ?? undefined,
          txHash: log.transactionHash ?? undefined,
          order: logOrder(log.blockNumber, log.logIndex),
        });
      };
      for (const log of dep) push("deposited", log);
      for (const log of lock) push("locked", log);
      for (const log of unlock) push("unlocked", log);
      for (const log of slash) push("slashed", log);
      for (const log of wd) push("withdrawn", log);
      return rows.sort((x, y) => (x.order > y.order ? -1 : x.order < y.order ? 1 : 0));
    },
  });

  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);

  const suppliers = useMemo(() => {
    const set = new Set<Address>();
    for (const e of events) set.add(getAddress(e.supplier));
    return [...set];
  }, [events]);

  const positionsQuery = useReadContracts({
    contracts: bond
      ? suppliers.flatMap((supplier) => [
          { address: bond, abi: BOND_ABI, functionName: "bondOf" as const, args: [supplier] as const },
          { address: bond, abi: BOND_ABI, functionName: "lockedOf" as const, args: [supplier] as const },
          { address: bond, abi: BOND_ABI, functionName: "unlockedOf" as const, args: [supplier] as const },
        ])
      : [],
    query: { enabled: Boolean(bond) && suppliers.length > 0 },
  });

  const positions = useMemo<BondPosition[]>(() => {
    const rows = positionsQuery.data;
    if (!rows) return [];
    return suppliers.map((supplier, i) => {
      const total = rows[i * 3]?.status === "success" ? ((rows[i * 3]?.result as bigint | undefined) ?? 0n) : 0n;
      const locked = rows[i * 3 + 1]?.status === "success" ? ((rows[i * 3 + 1]?.result as bigint | undefined) ?? 0n) : 0n;
      const unlocked = rows[i * 3 + 2]?.status === "success" ? ((rows[i * 3 + 2]?.result as bigint | undefined) ?? 0n) : 0n;
      return { supplier, total, locked, unlocked };
    });
  }, [positionsQuery.data, suppliers]);

  const refetch = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [QUERY_KEY, env.chainId, bond] });
    void positionsQuery.refetch();
  }, [queryClient, bond, positionsQuery]);

  useWatchContractEvent({ address: bond, abi: BOND_ABI, eventName: "BondDeposited", enabled: Boolean(bond), onLogs: refetch });
  useWatchContractEvent({ address: bond, abi: BOND_ABI, eventName: "BondLocked", enabled: Boolean(bond), onLogs: refetch });
  useWatchContractEvent({ address: bond, abi: BOND_ABI, eventName: "BondSlashed", enabled: Boolean(bond), onLogs: refetch });
  useWatchContractEvent({ address: bond, abi: BOND_ABI, eventName: "BondWithdrawn", enabled: Boolean(bond), onLogs: refetch });

  return {
    bondAddress: bond,
    events,
    positions,
    isLoading: eventsQuery.isLoading,
    isError: eventsQuery.isError,
    error: eventsQuery.error,
    refetch,
    deployed: Boolean(bond),
  };
}

export interface SupplierBondView {
  readonly total: bigint;
  readonly locked: bigint;
  readonly unlocked: bigint;
  readonly token?: Address;
  readonly isLoading: boolean;
  readonly refetch: () => void;
}

/** Reads a single supplier's current bond position + bonded token. */
export function useSupplierBond(supplier?: Address): SupplierBondView {
  const bond = getResolvedAddress("SupplierBond");
  const useRead = (functionName: string) =>
    useReadContract({
      address: bond,
      abi: BOND_ABI,
      functionName,
      args: supplier ? [supplier] : undefined,
      query: { enabled: Boolean(bond && supplier) },
    });

  const totalQ = useRead("bondOf");
  const lockedQ = useRead("lockedOf");
  const unlockedQ = useRead("unlockedOf");
  const tokenQ = useRead("bondTokenOf");

  const refetch = useCallback(() => {
    void totalQ.refetch();
    void lockedQ.refetch();
    void unlockedQ.refetch();
  }, [totalQ, lockedQ, unlockedQ]);

  return {
    total: (totalQ.data as bigint | undefined) ?? 0n,
    locked: (lockedQ.data as bigint | undefined) ?? 0n,
    unlocked: (unlockedQ.data as bigint | undefined) ?? 0n,
    token: (tokenQ.data as Address | undefined) ?? undefined,
    isLoading: totalQ.isLoading || lockedQ.isLoading,
    refetch,
  };
}
