"use client";

import { useCallback } from "react";
import type { Abi, Address } from "viem";
import { useReadContract, useWatchContractEvent } from "wagmi";
import { getAbi } from "@/lib/abis";
import { getResolvedAddress } from "@/lib/shared";

const ABI = getAbi("RiskPool") as Abi;

export interface RiskPoolView {
  readonly poolAddress?: Address;
  readonly tokenAddress?: Address;
  /** Backstop reserves held for the settlement token. */
  readonly reserves: bigint;
  readonly deployed: boolean;
  readonly isLoading: boolean;
  readonly refetch: () => void;
}

/**
 * Reads the RiskPool backstop reserves for the platform settlement token. The
 * RiskPool tops up the InsurancePool when a claim exceeds available capital.
 * Live via Covered / ToppedUp subscriptions.
 */
export function useInsuranceRiskPool(): RiskPoolView {
  const poolAddress = getResolvedAddress("RiskPool");
  const token = getResolvedAddress("MockUSDC");

  const reservesQ = useReadContract({
    address: poolAddress,
    abi: ABI,
    functionName: "reserves",
    args: token ? [token] : undefined,
    query: { enabled: Boolean(poolAddress && token) },
  });

  const refetch = useCallback(() => void reservesQ.refetch(), [reservesQ]);
  const enabled = Boolean(poolAddress);
  useWatchContractEvent({ address: poolAddress, abi: ABI, eventName: "Covered", enabled, onLogs: refetch });
  useWatchContractEvent({ address: poolAddress, abi: ABI, eventName: "ToppedUp", enabled, onLogs: refetch });

  return {
    poolAddress,
    tokenAddress: token,
    reserves: (reservesQ.data as bigint | undefined) ?? 0n,
    deployed: Boolean(poolAddress),
    isLoading: reservesQ.isLoading,
    refetch,
  };
}
