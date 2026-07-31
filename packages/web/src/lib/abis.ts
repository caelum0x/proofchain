/**
 * Contract ABIs (viem `const` form for full type inference).
 *
 * These mirror the interfaces defined in `docs/SPEC.md` and the artifacts
 * exported by `@proofchain/contracts` → `@proofchain/shared`. They are declared
 * locally as typed constants so the web package is independently type-checkable
 * and buildable (loose coupling per the spec). Contract *addresses* and verdict
 * *types* are imported from `@proofchain/shared` — see `./shared.ts`.
 *
 * The four core ABIs below are hand-written `const` tuples for maximal wagmi
 * type inference on the original supplier/buyer/verifier flows. Every OTHER
 * platform contract (SPEC2 M0–M10) is available via `ABI_REGISTRY` / `getAbi`,
 * bundled from the compiled artifacts (see `abis-generated/`).
 */
import type { Abi } from "viem";
import { GENERATED_ABIS } from "./abis-generated";
import type { ContractName } from "./contract-names";

export const provenanceRegistryAbi = [
  {
    type: "function",
    name: "registerBatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "batchId", type: "bytes32" },
      { name: "originHash", type: "bytes32" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "addCheckpoint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "batchId", type: "bytes32" },
      { name: "location", type: "string" },
      { name: "timestamp", type: "uint64" },
      { name: "dataHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getBatch",
    stateMutability: "view",
    inputs: [{ name: "batchId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "batchId", type: "bytes32" },
          { name: "supplier", type: "address" },
          { name: "originHash", type: "bytes32" },
          { name: "metadataURI", type: "string" },
          { name: "createdAt", type: "uint64" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getCheckpoints",
    stateMutability: "view",
    inputs: [{ name: "batchId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "batchId", type: "bytes32" },
          { name: "location", type: "string" },
          { name: "timestamp", type: "uint64" },
          { name: "dataHash", type: "bytes32" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "checkpointCount",
    stateMutability: "view",
    inputs: [{ name: "batchId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "hasRole",
    stateMutability: "view",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "REGISTRAR_ROLE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "event",
    name: "BatchRegistered",
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "supplier", type: "address", indexed: true },
      { name: "originHash", type: "bytes32", indexed: false },
      { name: "metadataURI", type: "string", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "CheckpointAdded",
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "location", type: "string", indexed: false },
      { name: "timestamp", type: "uint64", indexed: false },
      { name: "dataHash", type: "bytes32", indexed: false },
    ],
    anonymous: false,
  },
  { type: "error", name: "BatchExists", inputs: [{ name: "batchId", type: "bytes32" }] },
  { type: "error", name: "UnknownBatch", inputs: [{ name: "batchId", type: "bytes32" }] },
  { type: "error", name: "EmptyMetadata", inputs: [] },
] as const;

export const attestationRegistryAbi = [
  {
    type: "function",
    name: "getAttestation",
    stateMutability: "view",
    inputs: [{ name: "batchId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "batchId", type: "bytes32" },
          { name: "score", type: "uint16" },
          { name: "verdictHash", type: "bytes32" },
          { name: "verdictURI", type: "string" },
          { name: "attestedAt", type: "uint64" },
          { name: "agent", type: "address" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "isAttested",
    stateMutability: "view",
    inputs: [{ name: "batchId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "scoreOf",
    stateMutability: "view",
    inputs: [{ name: "batchId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    type: "event",
    name: "Attested",
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "score", type: "uint16", indexed: false },
      { name: "verdictHash", type: "bytes32", indexed: false },
      { name: "verdictURI", type: "string", indexed: false },
      { name: "agent", type: "address", indexed: true },
    ],
    anonymous: false,
  },
  { type: "error", name: "InvalidScore", inputs: [{ name: "score", type: "uint16" }] },
  { type: "error", name: "AlreadyAttested", inputs: [{ name: "batchId", type: "bytes32" }] },
  { type: "error", name: "NotAttested", inputs: [{ name: "batchId", type: "bytes32" }] },
] as const;

export const settlementEscrowAbi = [
  {
    type: "function",
    name: "fund",
    stateMutability: "nonpayable",
    inputs: [
      { name: "batchId", type: "bytes32" },
      { name: "supplier", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [{ name: "batchId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "refund",
    stateMutability: "nonpayable",
    inputs: [{ name: "batchId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getDeal",
    stateMutability: "view",
    inputs: [{ name: "batchId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "batchId", type: "bytes32" },
          { name: "buyer", type: "address" },
          { name: "supplier", type: "address" },
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "state", type: "uint8" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "passThreshold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    type: "function",
    name: "setPassThreshold",
    stateMutability: "nonpayable",
    inputs: [{ name: "newThreshold", type: "uint16" }],
    outputs: [],
  },
  {
    type: "event",
    name: "Funded",
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "supplier", type: "address", indexed: false },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Released",
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "supplier", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Disputed",
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "score", type: "uint16", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Refunded",
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PassThresholdUpdated",
    inputs: [
      { name: "oldT", type: "uint16", indexed: false },
      { name: "newT", type: "uint16", indexed: false },
    ],
    anonymous: false,
  },
  { type: "error", name: "DealExists", inputs: [{ name: "batchId", type: "bytes32" }] },
  { type: "error", name: "NotFunded", inputs: [{ name: "batchId", type: "bytes32" }] },
  { type: "error", name: "ZeroAmount", inputs: [] },
  { type: "error", name: "AlreadySettled", inputs: [{ name: "batchId", type: "bytes32" }] },
  { type: "error", name: "NotAttested", inputs: [{ name: "batchId", type: "bytes32" }] },
  { type: "error", name: "UnknownBatch", inputs: [{ name: "batchId", type: "bytes32" }] },
] as const;

export const mockUsdcAbi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Approval",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "spender", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

/**
 * The full ABI registry for every platform contract, keyed by canonical name.
 * Prefer the named `*Abi` consts above for the core contracts (better inference);
 * use this / `getAbi(name)` for all other modules.
 */
export const ABI_REGISTRY = GENERATED_ABIS;

/** Resolve a contract's ABI by canonical name. */
export function getAbi(name: ContractName): Abi {
  return GENERATED_ABIS[name] as Abi;
}
