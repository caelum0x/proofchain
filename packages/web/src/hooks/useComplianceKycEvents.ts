"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Abi, Address } from "viem";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { getAbi } from "@/lib/abis";
import { getResolvedAddress } from "@/lib/shared";
import { getErrorMessage } from "@/lib/errors";
import { env } from "@/lib/env";

const ABI = getAbi("KYCRegistry") as Abi;
const QUERY_KEY = "compliance-kyc-events";

export type KycRecordState = "verified" | "revoked";

/** The current KYC status per account, folded from KycSet / KycRevoked. */
export interface KycAccountRecord {
  readonly account: Address;
  readonly level: number;
  readonly provider?: Address;
  readonly state: KycRecordState;
  readonly order: bigint;
}

function order(blockNumber: bigint | null, logIndex: number | null): bigint {
  return (blockNumber ?? 0n) * 100_000n + BigInt(logIndex ?? 0);
}

/**
 * Indexes the KYCRegistry event log into the latest KYC status per account —
 * the dataset behind the AML monitoring page. Live via KycSet / KycRevoked
 * subscriptions that invalidate the query.
 */
export function useComplianceKycEvents() {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const address = getResolvedAddress("KYCRegistry");

  const query = useQuery<KycAccountRecord[]>({
    queryKey: [QUERY_KEY, env.chainId, address],
    enabled: Boolean(publicClient && address),
    queryFn: async () => {
      if (!publicClient || !address) return [];
      const fromBlock = env.deployBlock ?? "earliest";
      const [set, revoked] = await Promise.all([
        publicClient.getContractEvents({ address, abi: ABI, eventName: "KycSet", fromBlock, toBlock: "latest" }),
        publicClient.getContractEvents({ address, abi: ABI, eventName: "KycRevoked", fromBlock, toBlock: "latest" }),
      ]);

      interface Ev {
        readonly account: Address;
        readonly state: KycRecordState;
        readonly level: number;
        readonly provider?: Address;
        readonly order: bigint;
      }
      const events: Ev[] = [];
      for (const log of set) {
        const a = log.args as { account?: Address; level?: number | bigint; provider?: Address };
        if (!a.account) continue;
        events.push({
          account: a.account,
          state: "verified",
          level: Number(a.level ?? 0),
          provider: a.provider,
          order: order(log.blockNumber, log.logIndex),
        });
      }
      for (const log of revoked) {
        const a = log.args as { account?: Address; provider?: Address };
        if (!a.account) continue;
        events.push({ account: a.account, state: "revoked", level: 0, provider: a.provider, order: order(log.blockNumber, log.logIndex) });
      }

      events.sort((x, y) => (x.order < y.order ? -1 : x.order > y.order ? 1 : 0));
      const byAccount = new Map<string, KycAccountRecord>();
      for (const ev of events) {
        byAccount.set(ev.account.toLowerCase(), {
          account: ev.account,
          level: ev.level,
          provider: ev.provider,
          state: ev.state,
          order: ev.order,
        });
      }
      return [...byAccount.values()].sort((x, y) => (x.order > y.order ? -1 : x.order < y.order ? 1 : 0));
    },
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [QUERY_KEY, env.chainId, address] });
  }, [queryClient, address]);

  useWatchContractEvent({ address, abi: ABI, eventName: "KycSet", enabled: Boolean(address), onLogs: invalidate });
  useWatchContractEvent({ address, abi: ABI, eventName: "KycRevoked", enabled: Boolean(address), onLogs: invalidate });

  return {
    records: query.data ?? [],
    deployed: Boolean(address),
    isLoading: query.isLoading,
    error: query.isError ? getErrorMessage(query.error) : null,
    refetch: query.refetch,
  };
}
