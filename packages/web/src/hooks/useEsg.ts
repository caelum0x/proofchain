"use client";

import { useMemo } from "react";
import type { Address, Hex } from "viem";
import { useReadContract } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import { useContractLogs } from "./useContractLogs";

export interface EsgRecordItem {
  readonly subject: Hex;
  readonly score: number;
  readonly uri: string;
  readonly attestor: Address;
  readonly blockNumber: bigint;
  readonly transactionHash: Hex;
}

/** Enumerate ESG attestations from the registry's `EsgSet` logs (latest first). */
export function useEsgRecords() {
  const { logs, isLoading, isError, error, refetch, notDeployed } = useContractLogs({
    name: "ESGRegistry",
    eventName: "EsgSet",
  });

  const records = useMemo<EsgRecordItem[]>(() => {
    const seen = new Set<string>();
    const out: EsgRecordItem[] = [];
    for (const log of logs) {
      const subject = log.args.subject as Hex | undefined;
      if (!subject || seen.has(subject)) continue;
      seen.add(subject);
      out.push({
        subject,
        score: Number(log.args.score ?? 0),
        uri: String(log.args.uri ?? ""),
        attestor: (log.args.attestor as Address) ?? "0x0000000000000000000000000000000000000000",
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      });
    }
    return out;
  }, [logs]);

  return { records, isLoading, isError, error, refetch, notDeployed };
}

interface RawEsg {
  subject: Hex;
  score: number;
  uri: string;
  updatedAt: bigint;
  attestor: Address;
  exists: boolean;
}

/** Read the current ESG record + measured emissions for a subject (batch/org id). */
export function useEsgRecord(subject?: Hex) {
  const esg = tryContractRef("ESGRegistry");
  const oracle = tryContractRef("SustainabilityOracle");
  const enabled = Boolean(subject);

  const recordQuery = useReadContract({
    address: esg?.address,
    abi: esg?.abi,
    functionName: "esgOf",
    args: subject ? [subject] : undefined,
    query: { enabled: enabled && Boolean(esg) },
  });

  const emissionsQuery = useReadContract({
    address: oracle?.address,
    abi: oracle?.abi,
    functionName: "emissionsOf",
    args: subject ? [subject] : undefined,
    query: { enabled: enabled && Boolean(oracle) },
  });

  const raw = recordQuery.data as RawEsg | undefined;
  const record = raw && raw.exists
    ? {
        subject: raw.subject,
        score: Number(raw.score),
        uri: raw.uri,
        updatedAt: Number(raw.updatedAt),
        attestor: raw.attestor,
      }
    : null;

  const refetch = () => {
    void recordQuery.refetch();
    void emissionsQuery.refetch();
  };

  return {
    record,
    emissions: (emissionsQuery.data as bigint | undefined) ?? undefined,
    isLoading: recordQuery.isLoading,
    isError: recordQuery.isError,
    error: recordQuery.error ?? null,
    refetch,
  };
}
