"use client";

import { useMemo } from "react";
import type { Address, Hex } from "viem";
import { useReadContract } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import { useContractLogs } from "./useContractLogs";

/** A measured per-batch emissions reading from `SustainabilityOracle`. */
export interface EmissionsRecordItem {
  readonly batchId: Hex;
  readonly co2e: bigint;
  readonly keeper: Address;
  readonly blockNumber: bigint;
  readonly transactionHash: Hex;
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as Address;
const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

/** Measured emissions readings across all batches (latest first). */
export function useEmissionsRecords() {
  const { logs, isLoading, isError, error, refetch, notDeployed } = useContractLogs({
    name: "SustainabilityOracle",
    eventName: "EmissionsPushed",
  });
  const records = useMemo<EmissionsRecordItem[]>(
    () =>
      logs.map((log) => ({
        batchId: (log.args.batchId as Hex) ?? ZERO_HASH,
        co2e: toBig(log.args.co2e),
        keeper: (log.args.keeper as Address) ?? ZERO_ADDR,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      })),
    [logs],
  );
  return { records, isLoading, isError, error, refetch, notDeployed };
}

/** A historical emission-rate cap set on `EmissionsController`. */
export interface EmissionRateItem {
  readonly epoch: bigint;
  readonly rate: bigint;
  readonly blockNumber: bigint;
  readonly transactionHash: Hex;
}

/** The emissions-trading control state: current cap/epoch + rate history. */
export function useEmissionsController() {
  const ref = tryContractRef("EmissionsController");
  const history = useContractLogs({ name: "EmissionsController", eventName: "EmissionRateSet" });

  const rateQuery = useReadContract({
    address: ref?.address,
    abi: ref?.abi,
    functionName: "currentRate",
    query: { enabled: Boolean(ref) },
  });
  const epochQuery = useReadContract({
    address: ref?.address,
    abi: ref?.abi,
    functionName: "currentEpoch",
    query: { enabled: Boolean(ref) },
  });
  const maxQuery = useReadContract({
    address: ref?.address,
    abi: ref?.abi,
    functionName: "MAX_EMISSION_RATE",
    query: { enabled: Boolean(ref) },
  });

  const rateHistory = useMemo<EmissionRateItem[]>(
    () =>
      history.logs.map((log) => ({
        epoch: toBig(log.args.epoch),
        rate: toBig(log.args.rate),
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      })),
    [history.logs],
  );

  return {
    currentRate: (rateQuery.data as bigint | undefined) ?? undefined,
    currentEpoch: (epochQuery.data as bigint | undefined) ?? undefined,
    maxRate: (maxQuery.data as bigint | undefined) ?? undefined,
    rateHistory,
    notDeployed: !ref,
    isLoading: rateQuery.isLoading || history.isLoading,
    isError: history.isError,
    error: history.error,
    refetch: () => {
      void rateQuery.refetch();
      void epochQuery.refetch();
      void maxQuery.refetch();
      history.refetch();
    },
  };
}

function toBig(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return 0n;
}
