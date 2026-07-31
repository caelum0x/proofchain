import {
  encodeAbiParameters,
  encodeEventTopics,
  type Hex,
} from "viem";

/**
 * Locally-typed `as const` ABI fragments used only to *produce* valid encoded
 * logs in tests. The library code decodes against the exported (generic) ABIs;
 * these fragments give viem full type inference for the encoding side.
 *
 * viem (v2) does not export a single `encodeEventLog`, so we compose a log from
 * `encodeEventTopics` (indexed params + signature) and `encodeAbiParameters`
 * (non-indexed data), exactly mirroring how a node emits it.
 */
const batchRegisteredAbi = [
  {
    type: "event",
    name: "BatchRegistered",
    anonymous: false,
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "supplier", type: "address", indexed: true },
      { name: "originHash", type: "bytes32", indexed: false },
      { name: "metadataURI", type: "string", indexed: false },
    ],
  },
] as const;

const attestedAbi = [
  {
    type: "event",
    name: "Attested",
    anonymous: false,
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "score", type: "uint16", indexed: false },
      { name: "verdictHash", type: "bytes32", indexed: false },
      { name: "verdictURI", type: "string", indexed: false },
      { name: "agent", type: "address", indexed: true },
    ],
  },
] as const;

const fundedAbi = [
  {
    type: "event",
    name: "Funded",
    anonymous: false,
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "supplier", type: "address", indexed: false },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

const transferAbi = [
  {
    type: "event",
    name: "Transfer",
    anonymous: false,
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

export interface EncodedLog {
  readonly topics: readonly Hex[];
  readonly data: Hex;
}

// All indexed args are supplied in these fixtures, so every topic is a concrete
// hash; narrow viem's wider `(Hex | Hex[] | null)[]` return accordingly.
function asTopics(topics: readonly (Hex | readonly Hex[] | null)[]): Hex[] {
  return topics.map((t) => {
    if (typeof t !== "string") {
      throw new Error("Test fixture produced a non-scalar topic");
    }
    return t;
  });
}

const ADDR_A = "0x1111111111111111111111111111111111111111" as const;
const ADDR_B = "0x2222222222222222222222222222222222222222" as const;
const BATCH_ID =
  "0x00000000000000000000000000000000000000000000000000000000000000aa" as const;
const HASH =
  "0x00000000000000000000000000000000000000000000000000000000000000bb" as const;

export function encodeBatchRegistered(): EncodedLog {
  const topics = asTopics(
    encodeEventTopics({
      abi: batchRegisteredAbi,
      eventName: "BatchRegistered",
      args: { batchId: BATCH_ID, supplier: ADDR_A },
    }),
  );
  const data = encodeAbiParameters(
    [{ type: "bytes32" }, { type: "string" }],
    [HASH, "ipfs://meta"],
  );
  return { topics, data };
}

export function encodeAttested(score: number): EncodedLog {
  const topics = asTopics(
    encodeEventTopics({
      abi: attestedAbi,
      eventName: "Attested",
      args: { batchId: BATCH_ID, agent: ADDR_B },
    }),
  );
  const data = encodeAbiParameters(
    [{ type: "uint16" }, { type: "bytes32" }, { type: "string" }],
    [score, HASH, "ipfs://verdict"],
  );
  return { topics, data };
}

export function encodeFunded(amount: bigint): EncodedLog {
  const topics = asTopics(
    encodeEventTopics({
      abi: fundedAbi,
      eventName: "Funded",
      args: { batchId: BATCH_ID, buyer: ADDR_A },
    }),
  );
  const data = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "uint256" }],
    [ADDR_B, ADDR_A, amount],
  );
  return { topics, data };
}

export function encodeTransfer(value: bigint): EncodedLog {
  const topics = asTopics(
    encodeEventTopics({
      abi: transferAbi,
      eventName: "Transfer",
      args: { from: ADDR_A, to: ADDR_B },
    }),
  );
  const data = encodeAbiParameters([{ type: "uint256" }], [value]);
  return { topics, data };
}

export const FIXTURES = { ADDR_A, ADDR_B, BATCH_ID, HASH } as const;
