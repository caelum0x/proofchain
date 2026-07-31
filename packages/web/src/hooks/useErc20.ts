"use client";

import { useCallback } from "react";
import type { Address } from "viem";
import { useAccount, useReadContract, useWatchContractEvent } from "wagmi";
import { mockUsdcAbi } from "@/lib/abis";

/**
 * Generic ERC20 reader for any token + spender pair (a generalisation of the
 * MockUSDC-specific `useUsdc`). Reads metadata plus the connected account's
 * balance and allowance, and stays live by refetching on Transfer/Approval
 * events touching the account. `mockUsdcAbi` is a standard-ERC20 superset, so it
 * decodes any compliant token's reads/approve.
 */
export function useErc20(token?: Address, spender?: Address) {
  const { address: account } = useAccount();

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
    args: account && spender ? [account, spender] : undefined,
    query: { enabled: Boolean(token && account && spender) },
  });

  const refetch = useCallback(() => {
    void balanceQuery.refetch();
    void allowanceQuery.refetch();
  }, [balanceQuery, allowanceQuery]);

  useWatchContractEvent({
    address: token,
    abi: mockUsdcAbi,
    eventName: "Approval",
    args: account ? { owner: account } : undefined,
    enabled: Boolean(token && account),
    onLogs: () => void allowanceQuery.refetch(),
  });

  useWatchContractEvent({
    address: token,
    abi: mockUsdcAbi,
    eventName: "Transfer",
    args: account ? { from: account } : undefined,
    enabled: Boolean(token && account),
    onLogs: () => refetch(),
  });

  useWatchContractEvent({
    address: token,
    abi: mockUsdcAbi,
    eventName: "Transfer",
    args: account ? { to: account } : undefined,
    enabled: Boolean(token && account),
    onLogs: () => void balanceQuery.refetch(),
  });

  return {
    token,
    account,
    decimals: decimalsQuery.data ?? 18,
    symbol: symbolQuery.data ?? "TOKEN",
    balance: balanceQuery.data ?? 0n,
    allowance: allowanceQuery.data ?? 0n,
    isLoading: balanceQuery.isLoading || allowanceQuery.isLoading,
    refetch,
  };
}
