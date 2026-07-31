"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import { usePublicClient, useReadContracts, useWatchContractEvent } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import { env } from "@/lib/env";
import { decodeOrganizationView, type OrganizationView } from "@/lib/directory";

/**
 * Discover every organization from `OrgRegistered` logs (OrganizationRegistry
 * exposes no enumeration) and read the CURRENT record for each via a single
 * multicall, so later admin/membership state stays authoritative.
 */
export interface OrganizationsResult {
  readonly organizations: readonly OrganizationView[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: unknown;
  readonly notDeployed: boolean;
  readonly refetch: () => void;
}

export function useOrganizations(): OrganizationsResult {
  const publicClient = usePublicClient();
  const ref = tryContractRef("OrganizationRegistry");
  const address = ref?.address;

  const idsQuery = useQuery<Hex[]>({
    queryKey: ["org-ids", env.chainId, address],
    enabled: Boolean(publicClient && address),
    queryFn: async () => {
      if (!publicClient || !ref) return [];
      const logs = await publicClient.getContractEvents({
        address: ref.address,
        abi: ref.abi,
        eventName: "OrgRegistered",
        fromBlock: env.deployBlock ?? "earliest",
        toBlock: "latest",
      });
      const seen = new Set<string>();
      const ids: Hex[] = [];
      for (const log of logs) {
        const args = log.args as { orgId?: Hex };
        if (!args.orgId || seen.has(args.orgId)) continue;
        seen.add(args.orgId);
        ids.push(args.orgId);
      }
      return ids;
    },
  });

  const ids = useMemo(() => idsQuery.data ?? [], [idsQuery.data]);

  const orgsQuery = useReadContracts({
    contracts: ref
      ? ids.map((orgId) => ({
          address: ref.address,
          abi: ref.abi,
          functionName: "orgOf",
          args: [orgId],
        }))
      : [],
    query: { enabled: Boolean(ref) && ids.length > 0 },
  });

  const organizations = useMemo<OrganizationView[]>(() => {
    const rows = orgsQuery.data;
    if (!rows) return [];
    const out: OrganizationView[] = [];
    for (const row of rows) {
      if (row.status !== "success") continue;
      const decoded = decodeOrganizationView(row.result);
      if (decoded && decoded.exists) out.push(decoded);
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  }, [orgsQuery.data]);

  const refetch = useCallback(() => {
    void idsQuery.refetch();
    void orgsQuery.refetch();
  }, [idsQuery, orgsQuery]);

  useWatchContractEvent({
    address,
    abi: ref?.abi,
    eventName: "OrgRegistered",
    enabled: Boolean(address),
    onLogs: () => void idsQuery.refetch(),
  });

  const hasIds = ids.length > 0;

  return {
    organizations,
    isLoading: idsQuery.isLoading || (hasIds && orgsQuery.isLoading),
    isError: idsQuery.isError || orgsQuery.isError,
    error: idsQuery.error ?? orgsQuery.error ?? null,
    notDeployed: !address,
    refetch,
  };
}
