"use client";

import { useCallback } from "react";
import type { Abi, Address } from "viem";
import { useAccount, useReadContract, useWatchContractEvent } from "wagmi";
import { getAbi } from "@/lib/abis";
import { getResolvedAddress } from "@/lib/shared";
import { reservedRatioBps } from "@/lib/insurance";

const ABI = getAbi("InsurancePool") as Abi;

export interface InsurancePoolView {
  readonly poolAddress?: Address;
  readonly tokenAddress?: Address;
  readonly totalCapital: bigint;
  readonly availableCapital: bigint;
  readonly reservedCapital: bigint;
  readonly reservedRatioBps: number;
  /** The connected provider's supplied capital in the token. */
  readonly userDeposit: bigint;
  readonly isLoading: boolean;
  readonly refetch: () => void;
}

/**
 * Reads the InsurancePool's capital position (total / available / reserved) and
 * the connected provider's deposit for the platform stablecoin. Live via
 * Deposited/Withdrawn/PaidOut subscriptions.
 */
export function useInsurancePool(): InsurancePoolView {
  const { address: account } = useAccount();
  const poolAddress = getResolvedAddress("InsurancePool");
  const token = getResolvedAddress("MockUSDC");

  const totalQ = useReadContract({
    address: poolAddress,
    abi: ABI,
    functionName: "totalCapital",
    query: { enabled: Boolean(poolAddress) },
  });
  const availableQ = useReadContract({
    address: poolAddress,
    abi: ABI,
    functionName: "availableCapital",
    args: token ? [token] : undefined,
    query: { enabled: Boolean(poolAddress && token) },
  });
  const reservedQ = useReadContract({
    address: poolAddress,
    abi: ABI,
    functionName: "reservedCapital",
    query: { enabled: Boolean(poolAddress) },
  });
  const depositQ = useReadContract({
    address: poolAddress,
    abi: ABI,
    functionName: "depositOf",
    args: account && token ? [account, token] : undefined,
    query: { enabled: Boolean(poolAddress && account && token) },
  });

  const refetch = useCallback(() => {
    void totalQ.refetch();
    void availableQ.refetch();
    void reservedQ.refetch();
    void depositQ.refetch();
  }, [totalQ, availableQ, reservedQ, depositQ]);

  const enabled = Boolean(poolAddress);
  useWatchContractEvent({ address: poolAddress, abi: ABI, eventName: "Deposited", enabled, onLogs: refetch });
  useWatchContractEvent({ address: poolAddress, abi: ABI, eventName: "Withdrawn", enabled, onLogs: refetch });
  useWatchContractEvent({ address: poolAddress, abi: ABI, eventName: "PaidOut", enabled, onLogs: refetch });
  useWatchContractEvent({ address: poolAddress, abi: ABI, eventName: "Underwritten", enabled, onLogs: refetch });

  const total = (totalQ.data as bigint | undefined) ?? 0n;
  const reserved = (reservedQ.data as bigint | undefined) ?? 0n;

  return {
    poolAddress,
    tokenAddress: token,
    totalCapital: total,
    availableCapital: (availableQ.data as bigint | undefined) ?? 0n,
    reservedCapital: reserved,
    reservedRatioBps: reservedRatioBps(reserved, total),
    userDeposit: (depositQ.data as bigint | undefined) ?? 0n,
    isLoading: totalQ.isLoading,
    refetch,
  };
}
