"use client";

import { useCallback, useMemo } from "react";
import { useReadContracts } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import {
  decodeReputationView,
  EMPTY_REPUTATION,
  sortLeaderboard,
  type LeaderboardEntry,
} from "@/lib/directory";
import { useRegistryDirectory } from "./useRegistryDirectory";

/**
 * Rank registered suppliers by on-chain track record. Joins the supplier
 * directory with `ReputationEngine.reputationOf` and `ScoreOracle.gradeOf`
 * (one multicall) and orders them via {@link sortLeaderboard}.
 */
export interface LeaderboardResult {
  readonly entries: readonly LeaderboardEntry[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: unknown;
  readonly notDeployed: boolean;
  readonly refetch: () => void;
}

export function useLeaderboard(): LeaderboardResult {
  const directory = useRegistryDirectory("SupplierRegistry", "SupplierRegistered");
  const engine = tryContractRef("ReputationEngine");
  const oracle = tryContractRef("ScoreOracle");

  const accounts = useMemo(
    () => directory.profiles.map((p) => ({ account: p.account, name: p.name })),
    [directory.profiles],
  );

  const contracts = useMemo(() => {
    const list: Array<Record<string, unknown>> = [];
    for (const { account } of accounts) {
      if (engine) list.push({ address: engine.address, abi: engine.abi, functionName: "reputationOf", args: [account] });
      if (oracle) list.push({ address: oracle.address, abi: oracle.abi, functionName: "gradeOf", args: [account] });
    }
    return list;
  }, [accounts, engine, oracle]);

  const statsQuery = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: contracts as any,
    query: { enabled: Boolean(engine) && accounts.length > 0 },
  });

  const entries = useMemo<LeaderboardEntry[]>(() => {
    const perAccount = (engine ? 1 : 0) + (oracle ? 1 : 0);
    const rows = statsQuery.data;
    const built: LeaderboardEntry[] = accounts.map(({ account, name }, i) => {
      let reputation = EMPTY_REPUTATION;
      let grade = 0;
      if (rows && perAccount > 0) {
        let cursor = i * perAccount;
        if (engine) {
          const repRow = rows[cursor++];
          if (repRow?.status === "success") {
            reputation = decodeReputationView(repRow.result) ?? EMPTY_REPUTATION;
          }
        }
        if (oracle) {
          const gradeRow = rows[cursor++];
          if (gradeRow?.status === "success") grade = Number(gradeRow.result);
        }
      }
      return { account, name, reputation, grade };
    });
    return sortLeaderboard(built);
  }, [accounts, statsQuery.data, engine, oracle]);

  const refetch = useCallback(() => {
    directory.refetch();
    void statsQuery.refetch();
  }, [directory, statsQuery]);

  return {
    entries,
    isLoading: directory.isLoading || (accounts.length > 0 && statsQuery.isLoading),
    isError: directory.isError || statsQuery.isError,
    error: directory.error ?? statsQuery.error ?? null,
    notDeployed: directory.notDeployed,
    refetch,
  };
}
