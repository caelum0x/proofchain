"use client";

import { useCallback } from "react";
import type { Address, Hex } from "viem";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePublicClient, useReadContract, useWatchContractEvent } from "wagmi";
import { attestationRegistryAbi, settlementEscrowAbi } from "@/lib/abis";
import { contractAddresses } from "@/lib/shared";
import { env } from "@/lib/env";

/** An attestation discovered from an `Attested` event, network-wide. */
export interface AttestationFeedItem {
  readonly batchId: Hex;
  readonly score: number; // bps 0..10000
  readonly verdictHash: Hex;
  readonly verdictURI: string;
  readonly agent: Address;
  readonly blockNumber: bigint;
  readonly transactionHash: Hex;
  readonly logIndex: number;
}

const QUERY_KEY = "attestation-feed";
const DEFAULT_THRESHOLD = 7000;

/**
 * Network-wide attestation feed: every `Attested` event across all batches, most
 * recent first, plus the escrow pass threshold so the UI can render PASS/FAIL.
 * Live via a contract-event subscription.
 */
export function useAttestationFeed() {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const address = contractAddresses.attestationRegistry;

  const thresholdQuery = useReadContract({
    address: contractAddresses.settlementEscrow,
    abi: settlementEscrowAbi,
    functionName: "passThreshold",
    query: { enabled: Boolean(contractAddresses.settlementEscrow) },
  });

  const query = useQuery<AttestationFeedItem[]>({
    queryKey: [QUERY_KEY, env.chainId, address],
    enabled: Boolean(publicClient && address),
    queryFn: async () => {
      if (!publicClient || !address) return [];
      const logs = await publicClient.getContractEvents({
        address,
        abi: attestationRegistryAbi,
        eventName: "Attested",
        fromBlock: env.deployBlock ?? "earliest",
        toBlock: "latest",
      });
      return [...logs].reverse().map((log) => ({
        batchId: log.args.batchId ?? ("0x" as Hex),
        score: log.args.score !== undefined ? Number(log.args.score) : 0,
        verdictHash: log.args.verdictHash ?? ("0x" as Hex),
        verdictURI: log.args.verdictURI ?? "",
        agent: log.args.agent ?? ("0x" as Address),
        blockNumber: log.blockNumber ?? 0n,
        transactionHash: log.transactionHash ?? ("0x" as Hex),
        logIndex: log.logIndex ?? 0,
      }));
    },
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [QUERY_KEY, env.chainId, address] });
  }, [queryClient, address]);

  useWatchContractEvent({
    address,
    abi: attestationRegistryAbi,
    eventName: "Attested",
    enabled: Boolean(address),
    onLogs: () => invalidate(),
  });

  return {
    attestations: query.data ?? [],
    passThreshold: Number(thresholdQuery.data ?? DEFAULT_THRESHOLD),
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
