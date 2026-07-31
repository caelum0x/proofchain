"use client";

import { useMemo } from "react";
import type { Address } from "viem";
import { getAddress } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import { useContractLogs } from "./useContractLogs";

/**
 * Performance-bond reads for the `SupplierBond` contract (M4). Suppliers post a
 * bond that the protocol can lock against active deals and slash on proven
 * misconduct; this exposes the connected account's position plus a directory of
 * every bonded supplier discovered from `BondDeposited` events.
 */

export interface BondPosition {
  readonly supplier: Address;
  readonly total: bigint;
  readonly locked: bigint;
  readonly unlocked: bigint;
  readonly token?: Address;
}

export interface BondAccount extends BondPosition {
  readonly deployed: boolean;
  readonly contractAddress?: Address;
  readonly isLoading: boolean;
  readonly refetch: () => void;
}

const ZERO = 0n;

/** The connected account's (or an explicit account's) bond position. */
export function useBondAccount(explicit?: Address): BondAccount {
  const { address: connected } = useAccount();
  const account = explicit ?? connected;
  const bond = tryContractRef("SupplierBond");
  const enabled = Boolean(bond && account);

  const totalQuery = useReadContract({
    address: bond?.address,
    abi: bond?.abi,
    functionName: "bondOf",
    args: account ? [account] : undefined,
    query: { enabled },
  });
  const lockedQuery = useReadContract({
    address: bond?.address,
    abi: bond?.abi,
    functionName: "lockedOf",
    args: account ? [account] : undefined,
    query: { enabled },
  });
  const unlockedQuery = useReadContract({
    address: bond?.address,
    abi: bond?.abi,
    functionName: "unlockedOf",
    args: account ? [account] : undefined,
    query: { enabled },
  });
  const tokenQuery = useReadContract({
    address: bond?.address,
    abi: bond?.abi,
    functionName: "bondTokenOf",
    args: account ? [account] : undefined,
    query: { enabled },
  });

  const refetch = () => {
    void totalQuery.refetch();
    void lockedQuery.refetch();
    void unlockedQuery.refetch();
    void tokenQuery.refetch();
  };

  const token = tokenQuery.data as Address | undefined;
  const zeroAddr = "0x0000000000000000000000000000000000000000";

  return {
    supplier: account ?? zeroAddr,
    deployed: Boolean(bond),
    total: (totalQuery.data as bigint | undefined) ?? ZERO,
    locked: (lockedQuery.data as bigint | undefined) ?? ZERO,
    unlocked: (unlockedQuery.data as bigint | undefined) ?? ZERO,
    token: token && token !== zeroAddr ? token : undefined,
    contractAddress: bond?.address,
    isLoading: totalQuery.isLoading,
    refetch,
  };
}

export interface BondDirectory {
  readonly positions: readonly BondPosition[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: unknown;
  readonly notDeployed: boolean;
  readonly refetch: () => void;
}

/** Every bonded supplier, reconstructed from `BondDeposited` events + live reads. */
export function useBondDirectory(): BondDirectory {
  const bond = tryContractRef("SupplierBond");
  const logs = useContractLogs({ name: "SupplierBond", eventName: "BondDeposited" });

  const suppliers = useMemo<Address[]>(() => {
    const seen = new Set<string>();
    const out: Address[] = [];
    for (const log of logs.logs) {
      const supplier = log.args.supplier as Address | undefined;
      if (!supplier) continue;
      const key = supplier.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(getAddress(supplier));
    }
    return out;
  }, [logs.logs]);

  const reads = useReadContracts({
    contracts: bond
      ? suppliers.flatMap((s) => [
          { address: bond.address, abi: bond.abi, functionName: "bondOf", args: [s] },
          { address: bond.address, abi: bond.abi, functionName: "lockedOf", args: [s] },
          { address: bond.address, abi: bond.abi, functionName: "unlockedOf", args: [s] },
        ])
      : [],
    query: { enabled: Boolean(bond) && suppliers.length > 0 },
  });

  const positions = useMemo<BondPosition[]>(() => {
    const rows = reads.data;
    if (!rows) return [];
    return suppliers
      .map((supplier, i) => {
        const total = (rows[i * 3]?.result as bigint | undefined) ?? ZERO;
        const locked = (rows[i * 3 + 1]?.result as bigint | undefined) ?? ZERO;
        const unlocked = (rows[i * 3 + 2]?.result as bigint | undefined) ?? ZERO;
        return { supplier, total, locked, unlocked };
      })
      .filter((p) => p.total > ZERO)
      .sort((a, b) => (b.total > a.total ? 1 : b.total < a.total ? -1 : 0));
  }, [reads.data, suppliers]);

  return {
    positions,
    isLoading: logs.isLoading || reads.isLoading,
    isError: logs.isError || reads.isError,
    error: logs.error ?? reads.error ?? null,
    notDeployed: logs.notDeployed,
    refetch: () => {
      logs.refetch();
      void reads.refetch();
    },
  };
}
