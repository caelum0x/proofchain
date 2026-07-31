"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address, Hex } from "viem";
import { getAddress } from "viem";
import { usePublicClient, useReadContract, useWatchContractEvent } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import { env } from "@/lib/env";
import { decodeOrganizationView, type OrganizationView } from "@/lib/directory";

/**
 * Load a single organization: its `orgOf` record plus the current member set.
 * Membership has no on-chain enumeration, so we replay `MemberAdded` /
 * `MemberRemoved` logs for the org in order to reconstruct the live roster.
 */
export interface OrganizationResult {
  readonly organization: OrganizationView | null;
  readonly members: readonly Address[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: unknown;
  readonly notDeployed: boolean;
  readonly refetch: () => void;
}

export function useOrganization(orgId: Hex | undefined): OrganizationResult {
  const publicClient = usePublicClient();
  const ref = tryContractRef("OrganizationRegistry");
  const address = ref?.address;

  const orgQuery = useReadContract({
    address,
    abi: ref?.abi,
    functionName: "orgOf",
    args: orgId ? [orgId] : undefined,
    query: { enabled: Boolean(ref && orgId) },
  });

  const membersQuery = useQuery<Address[]>({
    queryKey: ["org-members", env.chainId, address, orgId],
    enabled: Boolean(publicClient && address && orgId),
    queryFn: async () => {
      if (!publicClient || !ref || !orgId) return [];
      const [added, removed] = await Promise.all([
        publicClient.getContractEvents({
          address: ref.address,
          abi: ref.abi,
          eventName: "MemberAdded",
          args: { orgId },
          fromBlock: env.deployBlock ?? "earliest",
          toBlock: "latest",
        }),
        publicClient.getContractEvents({
          address: ref.address,
          abi: ref.abi,
          eventName: "MemberRemoved",
          args: { orgId },
          fromBlock: env.deployBlock ?? "earliest",
          toBlock: "latest",
        }),
      ]);

      // Order add/remove events by block then log index to replay them faithfully.
      type Ev = { member: Address; added: boolean; block: bigint; index: number };
      const events: Ev[] = [];
      for (const log of added) {
        const m = (log.args as { member?: Address }).member;
        if (m) events.push({ member: getAddress(m), added: true, block: log.blockNumber ?? 0n, index: log.logIndex ?? 0 });
      }
      for (const log of removed) {
        const m = (log.args as { member?: Address }).member;
        if (m) events.push({ member: getAddress(m), added: false, block: log.blockNumber ?? 0n, index: log.logIndex ?? 0 });
      }
      events.sort((a, b) => (a.block === b.block ? a.index - b.index : a.block < b.block ? -1 : 1));

      const set = new Set<Address>();
      for (const ev of events) {
        if (ev.added) set.add(ev.member);
        else set.delete(ev.member);
      }
      return [...set];
    },
  });

  const refetch = useCallback(() => {
    void orgQuery.refetch();
    void membersQuery.refetch();
  }, [orgQuery, membersQuery]);

  const eventArgs = orgId ? { orgId } : undefined;

  useWatchContractEvent({
    address,
    abi: ref?.abi,
    eventName: "MemberAdded",
    args: eventArgs,
    enabled: Boolean(address && orgId),
    onLogs: () => void membersQuery.refetch(),
  });

  useWatchContractEvent({
    address,
    abi: ref?.abi,
    eventName: "MemberRemoved",
    args: eventArgs,
    enabled: Boolean(address && orgId),
    onLogs: () => void membersQuery.refetch(),
  });

  const decoded = orgQuery.data ? decodeOrganizationView(orgQuery.data) : null;
  const organization = useMemo(
    () => (decoded && decoded.exists ? decoded : null),
    [decoded],
  );

  return {
    organization,
    members: membersQuery.data ?? [],
    isLoading: orgQuery.isLoading || membersQuery.isLoading,
    isError: orgQuery.isError || membersQuery.isError,
    error: orgQuery.error ?? membersQuery.error ?? null,
    notDeployed: !address,
    refetch,
  };
}
