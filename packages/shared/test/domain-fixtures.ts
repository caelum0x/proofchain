/**
 * Log-encoding fixtures for the provenance / identity / reputation decoder
 * tests. Mirrors the approach in `./helpers.ts`: compose a raw log from
 * `encodeEventTopics` (signature + indexed params) and `encodeAbiParameters`
 * (non-indexed data), exactly as a node emits it.
 */
import {
  encodeAbiParameters,
  encodeEventTopics,
  type AbiEvent,
  type Hex,
} from "viem";

export interface EncodedLog {
  readonly topics: readonly Hex[];
  readonly data: Hex;
}

/** Build a raw EVM log for `event` from a full (indexed + non-indexed) arg map. */
export function buildLog(
  event: AbiEvent,
  args: Readonly<Record<string, unknown>>,
): EncodedLog {
  const indexedArgs: Record<string, unknown> = {};
  for (const input of event.inputs) {
    if (input.indexed === true && typeof input.name === "string") {
      indexedArgs[input.name] = args[input.name];
    }
  }
  const rawTopics = encodeEventTopics({
    abi: [event],
    eventName: event.name,
    args: indexedArgs,
  });
  const nonIndexed = event.inputs.filter((i) => i.indexed !== true);
  const data = encodeAbiParameters(
    nonIndexed,
    nonIndexed.map((i) => args[i.name ?? ""]),
  );
  const topics = rawTopics.map((t) => {
    if (typeof t !== "string") {
      throw new Error("Test fixture produced a non-scalar topic");
    }
    return t;
  });
  return { topics, data };
}

// ---------------------------------------------------------------------------
// Shared scalar fixtures
// ---------------------------------------------------------------------------

export const ADDR_A = "0x1111111111111111111111111111111111111111" as const;
export const ADDR_B = "0x2222222222222222222222222222222222222222" as const;
export const ADDR_C = "0x3333333333333333333333333333333333333333" as const;
export const BATCH_ID =
  "0x00000000000000000000000000000000000000000000000000000000000000aa" as const;
export const ORG_ID =
  "0x00000000000000000000000000000000000000000000000000000000000000cc" as const;
export const SERIES_ID =
  "0x00000000000000000000000000000000000000000000000000000000000000dd" as const;
export const HASH =
  "0x00000000000000000000000000000000000000000000000000000000000000bb" as const;
export const REASON =
  "0x00000000000000000000000000000000000000000000000000000000000000ee" as const;
export const META_KEY =
  "0x00000000000000000000000000000000000000000000000000000000000000ff" as const;

// ---------------------------------------------------------------------------
// Event ABI fragments
// ---------------------------------------------------------------------------

const ev = (name: string, inputs: AbiEvent["inputs"]): AbiEvent => ({
  type: "event",
  name,
  anonymous: false,
  inputs,
});

// provenance
export const BatchRegisteredEvent = ev("BatchRegistered", [
  { name: "batchId", type: "bytes32", indexed: true },
  { name: "supplier", type: "address", indexed: true },
  { name: "originHash", type: "bytes32", indexed: false },
  { name: "metadataURI", type: "string", indexed: false },
]);

export const CheckpointAddedEvent = ev("CheckpointAdded", [
  { name: "batchId", type: "bytes32", indexed: true },
  { name: "location", type: "string", indexed: false },
  { name: "timestamp", type: "uint64", indexed: false },
  { name: "dataHash", type: "bytes32", indexed: false },
]);

export const AttestedEvent = ev("Attested", [
  { name: "batchId", type: "bytes32", indexed: true },
  { name: "score", type: "uint16", indexed: false },
  { name: "verdictHash", type: "bytes32", indexed: false },
  { name: "verdictURI", type: "string", indexed: false },
  { name: "agent", type: "address", indexed: true },
]);

export const CheckpointPushedEvent = ev("CheckpointPushed", [
  { name: "batchId", type: "bytes32", indexed: true },
  { name: "location", type: "string", indexed: false },
  { name: "temp", type: "int256", indexed: false },
  { name: "dataHash", type: "bytes32", indexed: false },
  { name: "keeper", type: "address", indexed: true },
]);

export const RegisteredFromSeriesEvent = ev("RegisteredFromSeries", [
  { name: "seriesId", type: "bytes32", indexed: true },
  { name: "batchId", type: "bytes32", indexed: true },
  { name: "index", type: "uint256", indexed: false },
]);

export const MetadataSetEvent = ev("MetadataSet", [
  { name: "batchId", type: "bytes32", indexed: true },
  { name: "key", type: "bytes32", indexed: true },
  { name: "value", type: "string", indexed: false },
]);

// identity
export const OrgRegisteredEvent = ev("OrgRegistered", [
  { name: "orgId", type: "bytes32", indexed: true },
  { name: "name", type: "string", indexed: false },
  { name: "orgType", type: "uint8", indexed: false },
  { name: "admin", type: "address", indexed: true },
]);

export const MemberAddedEvent = ev("MemberAdded", [
  { name: "orgId", type: "bytes32", indexed: true },
  { name: "member", type: "address", indexed: true },
]);

export const SupplierRegisteredEvent = ev("SupplierRegistered", [
  { name: "account", type: "address", indexed: true },
  { name: "name", type: "string", indexed: false },
  { name: "uri", type: "string", indexed: false },
]);

export const KycSetEvent = ev("KycSet", [
  { name: "account", type: "address", indexed: true },
  { name: "level", type: "uint8", indexed: false },
  { name: "provider", type: "address", indexed: true },
]);

// reputation
export const OutcomeRecordedEvent = ev("OutcomeRecorded", [
  { name: "supplier", type: "address", indexed: true },
  { name: "passed", type: "bool", indexed: false },
  { name: "score", type: "uint16", indexed: false },
  { name: "newAvgScoreBps", type: "uint16", indexed: false },
]);

export const GradeParamsUpdatedEvent = ev("GradeParamsUpdated", [
  { name: "reputationWeightBps", type: "uint16", indexed: false },
  { name: "kycWeightBps", type: "uint16", indexed: false },
]);

export const SlashedEvent = ev("Slashed", [
  { name: "who", type: "address", indexed: true },
  { name: "amount", type: "uint256", indexed: false },
  { name: "reason", type: "bytes32", indexed: true },
  { name: "to", type: "address", indexed: true },
]);

export const BondDepositedEvent = ev("BondDeposited", [
  { name: "supplier", type: "address", indexed: true },
  { name: "token", type: "address", indexed: true },
  { name: "amount", type: "uint256", indexed: false },
]);

export const StakeSlashedEvent = ev("StakeSlashed", [
  { name: "account", type: "address", indexed: true },
  { name: "amount", type: "uint256", indexed: false },
  { name: "to", type: "address", indexed: true },
]);
