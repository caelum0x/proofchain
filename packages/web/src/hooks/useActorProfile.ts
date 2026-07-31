"use client";

import { useCallback } from "react";
import type { Address } from "viem";
import { useReadContract } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import type { ContractName } from "@/lib/contract-names";
import { decodeActorProfileView, type ActorProfileView } from "@/lib/directory";

/**
 * Read a single actor's profile from one of the identity registries
 * (SupplierRegistry / BuyerRegistry / CarrierRegistry). Returns `profile = null`
 * when the address has never registered (the on-chain `exists` flag is false),
 * which the detail pages render as a distinct empty state rather than an error.
 */
export interface ActorProfileResult {
  readonly profile: ActorProfileView | null;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: unknown;
  readonly notDeployed: boolean;
  readonly refetch: () => void;
}

export function useActorProfile(
  registry: ContractName,
  account: Address | undefined,
): ActorProfileResult {
  const ref = tryContractRef(registry);

  const query = useReadContract({
    address: ref?.address,
    abi: ref?.abi,
    functionName: "profileOf",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(ref && account) },
  });

  const refetch = useCallback(() => void query.refetch(), [query]);

  const decoded = query.data ? decodeActorProfileView(query.data) : null;
  const profile = decoded && decoded.exists ? decoded : null;

  return {
    profile,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    notDeployed: !ref?.address,
    refetch,
  };
}
