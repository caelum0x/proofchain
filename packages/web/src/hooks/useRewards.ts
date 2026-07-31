"use client";

import type { Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { tryContractRef } from "@/lib/contracts";

/** LoyaltyPoints balance + transferability for the connected account. */
export function useLoyalty() {
  const { address: account } = useAccount();
  const points = tryContractRef("LoyaltyPoints");

  const balanceQuery = useReadContract({
    address: points?.address,
    abi: points?.abi,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(points && account) },
  });

  const totalQuery = useReadContract({
    address: points?.address,
    abi: points?.abi,
    functionName: "totalSupply",
    query: { enabled: Boolean(points) },
  });

  const transferableQuery = useReadContract({
    address: points?.address,
    abi: points?.abi,
    functionName: "transferable",
    query: { enabled: Boolean(points) },
  });

  return {
    deployed: Boolean(points),
    balance: (balanceQuery.data as bigint | undefined) ?? 0n,
    totalSupply: (totalQuery.data as bigint | undefined) ?? 0n,
    transferable: Boolean(transferableQuery.data),
    isLoading: balanceQuery.isLoading,
    refetch: () => void balanceQuery.refetch(),
  };
}

/** StakingRewards position for the connected account plus pool-wide figures. */
export function useStakingRewards() {
  const { address: account } = useAccount();
  const rewards = tryContractRef("StakingRewards");

  const stakedQuery = useReadContract({
    address: rewards?.address,
    abi: rewards?.abi,
    functionName: "stakedOf",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(rewards && account) },
  });

  const earnedQuery = useReadContract({
    address: rewards?.address,
    abi: rewards?.abi,
    functionName: "earned",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(rewards && account) },
  });

  const totalQuery = useReadContract({
    address: rewards?.address,
    abi: rewards?.abi,
    functionName: "totalStaked",
    query: { enabled: Boolean(rewards) },
  });

  const rateQuery = useReadContract({
    address: rewards?.address,
    abi: rewards?.abi,
    functionName: "rewardRate",
    query: { enabled: Boolean(rewards) },
  });

  const tokenQuery = useReadContract({
    address: rewards?.address,
    abi: rewards?.abi,
    functionName: "stakingToken",
    query: { enabled: Boolean(rewards), staleTime: Infinity },
  });

  const refetch = () => {
    void stakedQuery.refetch();
    void earnedQuery.refetch();
    void totalQuery.refetch();
  };

  return {
    contract: rewards,
    deployed: Boolean(rewards),
    staked: (stakedQuery.data as bigint | undefined) ?? 0n,
    earned: (earnedQuery.data as bigint | undefined) ?? 0n,
    totalStaked: (totalQuery.data as bigint | undefined) ?? 0n,
    rewardRate: (rateQuery.data as bigint | undefined) ?? 0n,
    stakingToken: tokenQuery.data as Address | undefined,
    isLoading: stakedQuery.isLoading,
    refetch,
  };
}

/** EmissionsController current epoch + per-second rate. */
export function useEmissions() {
  const controller = tryContractRef("EmissionsController");
  const rateQuery = useReadContract({
    address: controller?.address,
    abi: controller?.abi,
    functionName: "currentRate",
    query: { enabled: Boolean(controller) },
  });
  const epochQuery = useReadContract({
    address: controller?.address,
    abi: controller?.abi,
    functionName: "currentEpoch",
    query: { enabled: Boolean(controller) },
  });
  return {
    deployed: Boolean(controller),
    rate: (rateQuery.data as bigint | undefined) ?? 0n,
    epoch: (epochQuery.data as bigint | undefined) ?? 0n,
  };
}
