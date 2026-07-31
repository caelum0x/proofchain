"use client";

import { useCallback } from "react";
import type { Address } from "viem";
import { useAccount, useReadContract, useWatchContractEvent } from "wagmi";
import { mockUsdcAbi } from "@/lib/abis";
import { contractAddresses } from "@/lib/shared";

/**
 * Reads MockUSDC token metadata plus the connected account's balance and its
 * allowance to the escrow. Refetches on Transfer/Approval events touching the
 * account so the approve→fund flow stays accurate.
 */
export function useUsdc(spender?: Address) {
  const { address: account } = useAccount();
  const token = contractAddresses.mockUsdc;
  const escrow = spender ?? contractAddresses.settlementEscrow;

  const decimalsQuery = useReadContract({
    address: token,
    abi: mockUsdcAbi,
    functionName: "decimals",
    query: { enabled: Boolean(token), staleTime: Infinity },
  });

  const symbolQuery = useReadContract({
    address: token,
    abi: mockUsdcAbi,
    functionName: "symbol",
    query: { enabled: Boolean(token), staleTime: Infinity },
  });

  const balanceQuery = useReadContract({
    address: token,
    abi: mockUsdcAbi,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(token && account) },
  });

  const allowanceQuery = useReadContract({
    address: token,
    abi: mockUsdcAbi,
    functionName: "allowance",
    args: account && escrow ? [account, escrow] : undefined,
    query: { enabled: Boolean(token && account && escrow) },
  });

  const refetch = useCallback(() => {
    void balanceQuery.refetch();
    void allowanceQuery.refetch();
  }, [balanceQuery, allowanceQuery]);

  // Only react to events touching THIS account (indexed-arg server-side filter),
  // instead of every Transfer/Approval emitted by the contract.
  useWatchContractEvent({
    address: token,
    abi: mockUsdcAbi,
    eventName: "Approval",
    args: account ? { owner: account } : undefined,
    enabled: Boolean(token && account),
    onLogs: () => void allowanceQuery.refetch(),
  });

  // Two watchers so both incoming (to) and outgoing (from, e.g. approve→fund)
  // transfers refresh the balance.
  useWatchContractEvent({
    address: token,
    abi: mockUsdcAbi,
    eventName: "Transfer",
    args: account ? { to: account } : undefined,
    enabled: Boolean(token && account),
    onLogs: () => void balanceQuery.refetch(),
  });

  useWatchContractEvent({
    address: token,
    abi: mockUsdcAbi,
    eventName: "Transfer",
    args: account ? { from: account } : undefined,
    enabled: Boolean(token && account),
    onLogs: () => void balanceQuery.refetch(),
  });

  return {
    token,
    decimals: decimalsQuery.data ?? 6,
    symbol: symbolQuery.data ?? "USDC",
    balance: balanceQuery.data ?? 0n,
    allowance: allowanceQuery.data ?? 0n,
    isLoading: balanceQuery.isLoading || allowanceQuery.isLoading,
    refetch,
  };
}
