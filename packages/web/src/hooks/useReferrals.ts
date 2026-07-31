"use client";

import { useMemo } from "react";
import type { Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import { useContractLogs } from "./useContractLogs";

const ZERO: Address = "0x0000000000000000000000000000000000000000";

export interface ReferralEventItem {
  readonly referrer: Address;
  readonly referee: Address;
  readonly blockNumber: bigint;
  readonly transactionHash: `0x${string}`;
}

/** The connected account's referral standing: referrer, pending reward, reward bps. */
export function useReferralStatus() {
  const { address: account } = useAccount();
  const program = tryContractRef("ReferralProgram");

  const referrerQuery = useReadContract({
    address: program?.address,
    abi: program?.abi,
    functionName: "referrerOf",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(program && account) },
  });

  const pendingQuery = useReadContract({
    address: program?.address,
    abi: program?.abi,
    functionName: "pendingReward",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(program && account) },
  });

  const bpsQuery = useReadContract({
    address: program?.address,
    abi: program?.abi,
    functionName: "rewardBps",
    query: { enabled: Boolean(program) },
  });

  const referrer = referrerQuery.data as Address | undefined;
  const refetch = () => {
    void referrerQuery.refetch();
    void pendingQuery.refetch();
  };

  return {
    account,
    contract: program,
    deployed: Boolean(program),
    referrer,
    hasReferrer: Boolean(referrer && referrer !== ZERO),
    pendingReward: (pendingQuery.data as bigint | undefined) ?? 0n,
    rewardBps: Number((bpsQuery.data as bigint | number | undefined) ?? 0),
    isLoading: referrerQuery.isLoading,
    refetch,
  };
}

/** Recent referral attributions (from `Referred` logs). */
export function useReferralEvents() {
  const { logs, ...rest } = useContractLogs({ name: "ReferralProgram", eventName: "Referred" });
  const items = useMemo<ReferralEventItem[]>(
    () =>
      logs.map((log) => ({
        referrer: (log.args.referrer as Address) ?? ZERO,
        referee: (log.args.referee as Address) ?? ZERO,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      })),
    [logs],
  );
  return { items, ...rest };
}
