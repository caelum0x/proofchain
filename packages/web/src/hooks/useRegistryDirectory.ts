"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { getAddress } from "viem";
import { usePublicClient, useReadContracts, useWatchContractEvent } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import type { ContractName } from "@/lib/contract-names";
import { env } from "@/lib/env";
import { decodeActorProfileView, type ActorProfileView } from "@/lib/directory";

/**
 * Generic directory reader for the actor registries (SupplierRegistry,
 * BuyerRegistry, CarrierRegistry). These share an identical `Profile` struct and
 * a `{Role}Registered(account, name, uri)` event but expose no on-chain
 * enumeration, so we discover accounts from event logs (the source of truth)
 * and then read the CURRENT `profileOf` for each — picking up any later
 * `{Role}Updated` edits — via a single multicall.
 */
export interface RegistryDirectory {
  readonly profiles: readonly ActorProfileView[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: unknown;
  readonly notDeployed: boolean;
  readonly refetch: () => void;
}

export function useRegistryDirectory(
  registry: ContractName,
  registeredEvent: string,
): RegistryDirectory {
  const publicClient = usePublicClient();
  const ref = tryContractRef(registry);
  const address = ref?.address;

  const accountsQuery = useQuery<Address[]>({
    queryKey: ["registry-accounts", registry, env.chainId, address],
    enabled: Boolean(publicClient && address),
    queryFn: async () => {
      if (!publicClient || !ref) return [];
      const logs = await publicClient.getContractEvents({
        address: ref.address,
        abi: ref.abi,
        eventName: registeredEvent,
        fromBlock: env.deployBlock ?? "earliest",
        toBlock: "latest",
      });
      const seen = new Set<string>();
      const accounts: Address[] = [];
      for (const log of logs) {
        const args = log.args as { account?: Address };
        const account = args.account;
        if (!account) continue;
        const key = account.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        accounts.push(getAddress(account));
      }
      return accounts;
    },
  });

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);

  const profilesQuery = useReadContracts({
    contracts: ref
      ? accounts.map((account) => ({
          address: ref.address,
          abi: ref.abi,
          functionName: "profileOf",
          args: [account],
        }))
      : [],
    query: { enabled: Boolean(ref) && accounts.length > 0 },
  });

  const profiles = useMemo<ActorProfileView[]>(() => {
    const rows = profilesQuery.data;
    if (!rows) return [];
    const out: ActorProfileView[] = [];
    for (const row of rows) {
      if (row.status !== "success") continue;
      const decoded = decodeActorProfileView(row.result);
      if (decoded && decoded.exists) out.push(decoded);
    }
    // Newest registrations first.
    return out.sort((a, b) => b.registeredAt - a.registeredAt);
  }, [profilesQuery.data]);

  const refetch = useCallback(() => {
    void accountsQuery.refetch();
    void profilesQuery.refetch();
  }, [accountsQuery, profilesQuery]);

  useWatchContractEvent({
    address,
    abi: ref?.abi,
    eventName: registeredEvent,
    enabled: Boolean(address),
    onLogs: () => void accountsQuery.refetch(),
  });

  const hasAccounts = accounts.length > 0;

  return {
    profiles,
    isLoading:
      accountsQuery.isLoading || (hasAccounts && profilesQuery.isLoading),
    isError: accountsQuery.isError || profilesQuery.isError,
    error: accountsQuery.error ?? profilesQuery.error ?? null,
    notDeployed: !address,
    refetch,
  };
}
