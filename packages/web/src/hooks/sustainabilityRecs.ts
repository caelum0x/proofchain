"use client";

import { useMemo } from "react";
import type { Address, Hex } from "viem";
import { useContractLogs } from "./useContractLogs";

/**
 * Renewable Energy Certificate view over the on-chain carbon registry. Each
 * ERC-1155 `projectId` on `CarbonCreditToken` is treated as a certificate
 * series: minted supply is "issued", `Retired` amounts are "retired", and the
 * remainder is the tradable/active balance.
 */
export interface RecItem {
  readonly projectId: bigint;
  readonly issued: bigint;
  readonly retired: bigint;
  readonly active: bigint;
  readonly holders: number;
  readonly lastBlock: bigint;
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

export function useRecs() {
  const mints = useContractLogs({ name: "CarbonCreditToken", eventName: "TransferSingle" });
  const retirements = useContractLogs({ name: "CarbonCreditToken", eventName: "Retired" });

  const recs = useMemo<RecItem[]>(() => {
    const byProject = new Map<
      string,
      { projectId: bigint; issued: bigint; retired: bigint; holders: Set<string>; lastBlock: bigint }
    >();

    const ensure = (projectId: bigint) => {
      const key = projectId.toString();
      let entry = byProject.get(key);
      if (!entry) {
        entry = { projectId, issued: 0n, retired: 0n, holders: new Set(), lastBlock: 0n };
        byProject.set(key, entry);
      }
      return entry;
    };

    for (const log of mints.logs) {
      const id = toBig(log.args.id);
      const from = String(log.args.from ?? ZERO_ADDR).toLowerCase();
      const to = String(log.args.to ?? ZERO_ADDR).toLowerCase();
      const value = toBig(log.args.value);
      const entry = ensure(id);
      if (from === ZERO_ADDR) entry.issued += value; // mint
      if (to !== ZERO_ADDR) entry.holders.add(to);
      if (log.blockNumber > entry.lastBlock) entry.lastBlock = log.blockNumber;
    }

    for (const log of retirements.logs) {
      const id = toBig(log.args.projectId);
      const entry = ensure(id);
      entry.retired += toBig(log.args.amount);
      if (log.blockNumber > entry.lastBlock) entry.lastBlock = log.blockNumber;
    }

    return [...byProject.values()]
      .map((e) => ({
        projectId: e.projectId,
        issued: e.issued,
        retired: e.retired,
        active: e.issued - e.retired > 0n ? e.issued - e.retired : 0n,
        holders: e.holders.size,
        lastBlock: e.lastBlock,
      }))
      .sort((a, b) => (b.lastBlock > a.lastBlock ? 1 : b.lastBlock < a.lastBlock ? -1 : Number(a.projectId - b.projectId)));
  }, [mints.logs, retirements.logs]);

  return {
    recs,
    isLoading: mints.isLoading || retirements.isLoading,
    isError: mints.isError,
    error: mints.error,
    notDeployed: mints.notDeployed,
    refetch: () => {
      mints.refetch();
      retirements.refetch();
    },
  };
}

function toBig(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return 0n;
}

export type { Address, Hex };
