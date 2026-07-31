"use client";

import { useMemo } from "react";
import type { Address, Hex } from "viem";
import { useReadContract } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import { useContractLogs } from "./useContractLogs";

/** A registered logistics carrier (the fleet operators pushing checkpoints). */
export interface CarrierItem {
  readonly account: Address;
  readonly name: string;
  readonly uri: string;
  readonly blockNumber: bigint;
  readonly transactionHash: Hex;
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as Address;

/** All registered carriers (de-duplicated, latest registration/update first). */
export function useCarriers() {
  const registered = useContractLogs({ name: "CarrierRegistry", eventName: "CarrierRegistered" });
  const updated = useContractLogs({ name: "CarrierRegistry", eventName: "CarrierUpdated" });

  const carriers = useMemo<CarrierItem[]>(() => {
    const byAccount = new Map<string, CarrierItem>();
    // Updates (newer) come first so they win; then registrations fill gaps.
    for (const log of [...updated.logs, ...registered.logs]) {
      const account = (log.args.account as Address) ?? ZERO_ADDR;
      const key = account.toLowerCase();
      if (byAccount.has(key)) continue;
      byAccount.set(key, {
        account,
        name: String(log.args.name ?? ""),
        uri: String(log.args.uri ?? ""),
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      });
    }
    return [...byAccount.values()].sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : b.blockNumber < a.blockNumber ? -1 : 0));
  }, [registered.logs, updated.logs]);

  return {
    carriers,
    isLoading: registered.isLoading || updated.isLoading,
    isError: registered.isError,
    error: registered.error,
    notDeployed: registered.notDeployed,
    refetch: () => {
      registered.refetch();
      updated.refetch();
    },
  };
}

interface RawProfile {
  account: Address;
  name: string;
  uri: string;
  registeredAt: bigint;
  exists: boolean;
}

/** Is the connected account a registered carrier, and its profile. */
export function useCarrierProfile(account?: Address) {
  const ref = tryContractRef("CarrierRegistry");
  const enabled = Boolean(account && ref);

  const profileQuery = useReadContract({
    address: ref?.address,
    abi: ref?.abi,
    functionName: "profileOf",
    args: account ? [account] : undefined,
    query: { enabled },
  });

  const raw = profileQuery.data as RawProfile | undefined;
  return {
    profile: raw && raw.exists ? raw : null,
    notDeployed: !ref,
    isLoading: profileQuery.isLoading,
    refetch: () => void profileQuery.refetch(),
  };
}
