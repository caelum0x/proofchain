import type { Address, Hex } from "viem";
import {
  DealState,
  type AttestationView,
  type BatchView,
  type CheckpointView,
  type DealStateValue,
  type DealView,
} from "./types";

/**
 * Convert raw viem contract-read tuples into UI view models. viem decodes named
 * tuple components into objects, so these functions are mostly bigint→number
 * narrowing plus enum coercion — done in one place for consistency.
 */

interface RawBatch {
  batchId: Hex;
  supplier: Address;
  originHash: Hex;
  metadataURI: string;
  createdAt: bigint;
  exists: boolean;
}

interface RawCheckpoint {
  batchId: Hex;
  location: string;
  timestamp: bigint;
  dataHash: Hex;
}

interface RawAttestation {
  batchId: Hex;
  score: number;
  verdictHash: Hex;
  verdictURI: string;
  attestedAt: bigint;
  agent: Address;
  exists: boolean;
}

interface RawDeal {
  batchId: Hex;
  buyer: Address;
  supplier: Address;
  token: Address;
  amount: bigint;
  state: number;
}

function toSeconds(value: bigint): number {
  return Number(value);
}

export function decodeBatch(raw: RawBatch): BatchView {
  return {
    batchId: raw.batchId,
    supplier: raw.supplier,
    originHash: raw.originHash,
    metadataURI: raw.metadataURI,
    createdAt: toSeconds(raw.createdAt),
    exists: raw.exists,
  };
}

export function decodeCheckpoint(raw: RawCheckpoint): CheckpointView {
  return {
    batchId: raw.batchId,
    location: raw.location,
    timestamp: toSeconds(raw.timestamp),
    dataHash: raw.dataHash,
  };
}

export function decodeCheckpoints(raw: readonly RawCheckpoint[]): CheckpointView[] {
  return raw.map(decodeCheckpoint);
}

export function decodeAttestation(raw: RawAttestation): AttestationView {
  return {
    batchId: raw.batchId,
    score: raw.score,
    verdictHash: raw.verdictHash,
    verdictURI: raw.verdictURI,
    attestedAt: toSeconds(raw.attestedAt),
    agent: raw.agent,
    exists: raw.exists,
  };
}

function coerceDealState(state: number): DealStateValue {
  const values = Object.values(DealState) as DealStateValue[];
  const match = values.find((v) => v === state);
  return match ?? DealState.None;
}

export function decodeDeal(raw: RawDeal): DealView {
  return {
    batchId: raw.batchId,
    buyer: raw.buyer,
    supplier: raw.supplier,
    token: raw.token,
    amount: raw.amount,
    state: coerceDealState(raw.state),
  };
}
