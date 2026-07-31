"use client";

import { useCallback } from "react";
import type { Hex } from "viem";
import { useReadContract, useWatchContractEvent } from "wagmi";
import {
  attestationRegistryAbi,
  provenanceRegistryAbi,
  settlementEscrowAbi,
} from "@/lib/abis";
import { contractAddresses } from "@/lib/shared";
import {
  decodeAttestation,
  decodeBatch,
  decodeCheckpoints,
  decodeDeal,
} from "@/lib/decode";

/**
 * Loads the full on-chain state for a single batch — provenance, checkpoints,
 * attestation, and escrow deal — and re-fetches automatically when any relevant
 * event fires for that batch (real-time detail view).
 */
export function useBatchDetail(batchId: Hex | undefined) {
  const provenance = contractAddresses.provenanceRegistry;
  const attestation = contractAddresses.attestationRegistry;
  const escrow = contractAddresses.settlementEscrow;
  const enabled = Boolean(batchId);

  const batchQuery = useReadContract({
    address: provenance,
    abi: provenanceRegistryAbi,
    functionName: "getBatch",
    args: batchId ? [batchId] : undefined,
    query: { enabled: enabled && Boolean(provenance) },
  });

  const checkpointsQuery = useReadContract({
    address: provenance,
    abi: provenanceRegistryAbi,
    functionName: "getCheckpoints",
    args: batchId ? [batchId] : undefined,
    query: { enabled: enabled && Boolean(provenance) },
  });

  const attestationQuery = useReadContract({
    address: attestation,
    abi: attestationRegistryAbi,
    functionName: "getAttestation",
    args: batchId ? [batchId] : undefined,
    query: { enabled: enabled && Boolean(attestation) },
  });

  const dealQuery = useReadContract({
    address: escrow,
    abi: settlementEscrowAbi,
    functionName: "getDeal",
    args: batchId ? [batchId] : undefined,
    query: { enabled: enabled && Boolean(escrow) },
  });

  const thresholdQuery = useReadContract({
    address: escrow,
    abi: settlementEscrowAbi,
    functionName: "passThreshold",
    query: { enabled: Boolean(escrow) },
  });

  const refetch = useCallback(() => {
    void batchQuery.refetch();
    void checkpointsQuery.refetch();
    void attestationQuery.refetch();
    void dealQuery.refetch();
  }, [batchQuery, checkpointsQuery, attestationQuery, dealQuery]);

  const eventArgs = batchId ? { batchId } : undefined;

  useWatchContractEvent({
    address: provenance,
    abi: provenanceRegistryAbi,
    eventName: "CheckpointAdded",
    args: eventArgs,
    enabled: Boolean(provenance && batchId),
    onLogs: () => void checkpointsQuery.refetch(),
  });

  useWatchContractEvent({
    address: attestation,
    abi: attestationRegistryAbi,
    eventName: "Attested",
    args: eventArgs,
    enabled: Boolean(attestation && batchId),
    onLogs: () => void attestationQuery.refetch(),
  });

  useWatchContractEvent({
    address: escrow,
    abi: settlementEscrowAbi,
    eventName: "Funded",
    args: eventArgs,
    enabled: Boolean(escrow && batchId),
    onLogs: () => void dealQuery.refetch(),
  });

  useWatchContractEvent({
    address: escrow,
    abi: settlementEscrowAbi,
    eventName: "Released",
    args: eventArgs,
    enabled: Boolean(escrow && batchId),
    onLogs: () => void dealQuery.refetch(),
  });

  useWatchContractEvent({
    address: escrow,
    abi: settlementEscrowAbi,
    eventName: "Disputed",
    args: eventArgs,
    enabled: Boolean(escrow && batchId),
    onLogs: () => void dealQuery.refetch(),
  });

  useWatchContractEvent({
    address: escrow,
    abi: settlementEscrowAbi,
    eventName: "Refunded",
    args: eventArgs,
    enabled: Boolean(escrow && batchId),
    onLogs: () => void dealQuery.refetch(),
  });

  const batchRaw = batchQuery.data;
  const batch = batchRaw && batchRaw.exists ? decodeBatch(batchRaw) : null;
  const checkpoints = checkpointsQuery.data ? decodeCheckpoints(checkpointsQuery.data) : [];
  const attestationRaw = attestationQuery.data;
  const attestationView =
    attestationRaw && attestationRaw.exists ? decodeAttestation(attestationRaw) : null;
  const dealRaw = dealQuery.data;
  const deal = dealRaw ? decodeDeal(dealRaw) : null;

  return {
    batch,
    checkpoints,
    attestation: attestationView,
    deal,
    passThreshold: thresholdQuery.data ?? undefined,
    isLoading:
      batchQuery.isLoading ||
      checkpointsQuery.isLoading ||
      attestationQuery.isLoading ||
      dealQuery.isLoading,
    isError:
      batchQuery.isError ||
      checkpointsQuery.isError ||
      attestationQuery.isError ||
      dealQuery.isError,
    error:
      batchQuery.error ??
      checkpointsQuery.error ??
      attestationQuery.error ??
      dealQuery.error ??
      null,
    refetch,
  };
}
