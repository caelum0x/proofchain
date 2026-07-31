"use client";

import { useCallback, useMemo } from "react";
import type { Abi, Hex } from "viem";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import type { ContractName } from "@/lib/contract-names";
import { env } from "@/lib/env";

/**
 * A single decoded on-chain event log, normalised into a stable shape the
 * domain hooks can consume without touching viem's generic log typing.
 */
export interface DecodedLog {
  readonly args: Readonly<Record<string, unknown>>;
  readonly blockNumber: bigint;
  readonly transactionHash: Hex;
  readonly logIndex: number;
}

interface UseContractLogsOptions {
  /** Canonical platform contract name to read events from. */
  readonly name: ContractName;
  /** Event name as declared in the contract ABI. */
  readonly eventName: string;
  /** Server-side indexed-arg filter (e.g. `{ account }`). */
  readonly args?: Readonly<Record<string, unknown>>;
  /** Gate the query/subscription (defaults to true). */
  readonly enabled?: boolean;
}

export interface UseContractLogsResult {
  readonly logs: readonly DecodedLog[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: unknown;
  readonly refetch: () => void;
  /** True when the target contract is not deployed on the active chain. */
  readonly notDeployed: boolean;
}

/**
 * Generic, resilient event-log scanner for any platform contract.
 *
 * Platform registries expose no on-chain enumeration, so — exactly like the
 * original `useBatches` — we discover records by reading historical logs and
 * keep them live via `useWatchContractEvent`. Every domain hook builds on this
 * so log fetching, block-range handling, and live invalidation live in one place.
 */
export function useContractLogs(options: UseContractLogsOptions): UseContractLogsResult {
  const { name, eventName, args, enabled = true } = options;
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  const ref = tryContractRef(name);
  const address = ref?.address;
  const abi = ref?.abi as Abi | undefined;

  // Stable JSON key for the optional indexed-arg filter.
  const argsKey = args ? JSON.stringify(args, bigintReplacer) : "";
  const queryKey = useMemo(
    () => ["contract-logs", env.chainId, name, eventName, address, argsKey] as const,
    [name, eventName, address, argsKey],
  );

  const query = useQuery<DecodedLog[]>({
    queryKey,
    enabled: enabled && Boolean(publicClient && address && abi),
    queryFn: async () => {
      if (!publicClient || !address || !abi) return [];
      const logs = await publicClient.getContractEvents({
        address,
        abi,
        eventName,
        args,
        fromBlock: env.deployBlock ?? "earliest",
        toBlock: "latest",
      });
      // Most-recent first, normalised to a stable shape.
      return [...logs].reverse().map((log) => ({
        args: (log as { args?: Record<string, unknown> }).args ?? {},
        blockNumber: log.blockNumber ?? 0n,
        transactionHash: log.transactionHash ?? ("0x" as Hex),
        logIndex: log.logIndex ?? 0,
      }));
    },
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  useWatchContractEvent({
    address,
    abi,
    eventName,
    args,
    enabled: enabled && Boolean(address && abi),
    onLogs: () => invalidate(),
  });

  return {
    logs: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: () => void query.refetch(),
    notDeployed: !address,
  };
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}
