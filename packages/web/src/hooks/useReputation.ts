"use client";

import { useCallback } from "react";
import type { Address } from "viem";
import { useReadContract } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import {
  decodeReputationView,
  EMPTY_REPUTATION,
  type ReputationView,
} from "@/lib/directory";

/**
 * On-chain reputation for a supplier address: the composite stats from
 * `ReputationEngine.reputationOf` plus the blended risk grade from
 * `ScoreOracle.gradeOf`. Both reads are independently gated on their contract
 * being deployed so the page degrades gracefully if only one module is live.
 */
export interface ReputationResult {
  readonly reputation: ReputationView;
  readonly grade: number;
  readonly hasReputation: boolean;
  readonly gradeAvailable: boolean;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: unknown;
  readonly notDeployed: boolean;
  readonly refetch: () => void;
}

export function useReputation(account: Address | undefined): ReputationResult {
  const engine = tryContractRef("ReputationEngine");
  const oracle = tryContractRef("ScoreOracle");

  const repQuery = useReadContract({
    address: engine?.address,
    abi: engine?.abi,
    functionName: "reputationOf",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(engine && account) },
  });

  const gradeQuery = useReadContract({
    address: oracle?.address,
    abi: oracle?.abi,
    functionName: "gradeOf",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(oracle && account) },
  });

  const refetch = useCallback(() => {
    void repQuery.refetch();
    void gradeQuery.refetch();
  }, [repQuery, gradeQuery]);

  const decoded = repQuery.data !== undefined ? decodeReputationView(repQuery.data) : null;
  const reputation = decoded ?? EMPTY_REPUTATION;
  const grade = gradeQuery.data !== undefined ? Number(gradeQuery.data) : 0;

  return {
    reputation,
    grade,
    hasReputation: reputation.totalDeals > 0,
    gradeAvailable: Boolean(oracle),
    isLoading: repQuery.isLoading || gradeQuery.isLoading,
    isError: repQuery.isError,
    error: repQuery.error ?? gradeQuery.error ?? null,
    notDeployed: !engine?.address,
    refetch,
  };
}
