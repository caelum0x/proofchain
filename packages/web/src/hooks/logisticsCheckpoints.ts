"use client";

import { useMemo } from "react";
import type { Address, Hex } from "viem";
import { useReadContract } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import { useContractLogs } from "./useContractLogs";

/** A single IoT/location checkpoint pushed to `CheckpointOracle`. */
export interface CheckpointItem {
  readonly batchId: Hex;
  readonly location: string;
  readonly temp: bigint;
  readonly dataHash: Hex;
  readonly keeper: Address;
  readonly blockNumber: bigint;
  readonly transactionHash: Hex;
  readonly logIndex: number;
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as Address;
const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

function toCheckpoint(args: Readonly<Record<string, unknown>>, log: { blockNumber: bigint; transactionHash: Hex; logIndex: number }): CheckpointItem {
  return {
    batchId: (args.batchId as Hex) ?? ZERO_HASH,
    location: String(args.location ?? ""),
    temp: toBig(args.temp),
    dataHash: (args.dataHash as Hex) ?? ZERO_HASH,
    keeper: (args.keeper as Address) ?? ZERO_ADDR,
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
  };
}

/** Every checkpoint across all shipments (latest first). Powers cold-chain + PoD. */
export function useCheckpoints() {
  const { logs, isLoading, isError, error, refetch, notDeployed } = useContractLogs({
    name: "CheckpointOracle",
    eventName: "CheckpointPushed",
  });
  const checkpoints = useMemo<CheckpointItem[]>(() => logs.map((l) => toCheckpoint(l.args, l)), [logs]);
  return { checkpoints, isLoading, isError, error, refetch, notDeployed };
}

/** A freight shipment: one batchId aggregated from its checkpoint trail. */
export interface ShipmentItem {
  readonly batchId: Hex;
  readonly checkpoints: number;
  readonly lastLocation: string;
  readonly lastTemp: bigint;
  readonly lastKeeper: Address;
  readonly lastBlock: bigint;
  readonly firstBlock: bigint;
}

/** Group all checkpoints into shipments keyed by batchId (most recently updated first). */
export function useShipments() {
  const { checkpoints, ...rest } = useCheckpoints();
  const shipments = useMemo<ShipmentItem[]>(() => {
    const byBatch = new Map<string, ShipmentItem>();
    // `checkpoints` is latest-first; iterate to build aggregates.
    for (const cp of checkpoints) {
      const existing = byBatch.get(cp.batchId);
      if (!existing) {
        byBatch.set(cp.batchId, {
          batchId: cp.batchId,
          checkpoints: 1,
          lastLocation: cp.location,
          lastTemp: cp.temp,
          lastKeeper: cp.keeper,
          lastBlock: cp.blockNumber,
          firstBlock: cp.blockNumber,
        });
      } else {
        byBatch.set(cp.batchId, {
          ...existing,
          checkpoints: existing.checkpoints + 1,
          firstBlock: cp.blockNumber < existing.firstBlock ? cp.blockNumber : existing.firstBlock,
        });
      }
    }
    return [...byBatch.values()].sort((a, b) => (b.lastBlock > a.lastBlock ? 1 : b.lastBlock < a.lastBlock ? -1 : 0));
  }, [checkpoints]);
  return { shipments, ...rest };
}

/** All checkpoints for a single shipment/container (chronological) + measured emissions. */
export function useShipment(batchId?: Hex) {
  const { checkpoints, isLoading, isError, error, refetch, notDeployed } = useCheckpoints();
  const oracle = tryContractRef("SustainabilityOracle");

  const trail = useMemo<CheckpointItem[]>(() => {
    if (!batchId) return [];
    return checkpoints
      .filter((c) => c.batchId.toLowerCase() === batchId.toLowerCase())
      .sort((a, b) => (a.blockNumber > b.blockNumber ? 1 : a.blockNumber < b.blockNumber ? -1 : a.logIndex - b.logIndex));
  }, [checkpoints, batchId]);

  const emissionsQuery = useReadContract({
    address: oracle?.address,
    abi: oracle?.abi,
    functionName: "emissionsOf",
    args: batchId ? [batchId] : undefined,
    query: { enabled: Boolean(batchId && oracle) },
  });

  return {
    trail,
    emissions: (emissionsQuery.data as bigint | undefined) ?? undefined,
    isLoading,
    isError,
    error,
    notDeployed,
    refetch: () => {
      refetch();
      void emissionsQuery.refetch();
    },
  };
}

function toBig(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  if (typeof value === "string" && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
}

export { ZERO_HASH as ZERO_BYTES32 };
