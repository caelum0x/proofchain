/**
 * Deterministic test double for the `@proofchain/shared` workspace package.
 *
 * WHY THIS EXISTS
 * ---------------
 * `@proofchain/shared` is produced by the `contracts` build and assembled during
 * the monorepo integration phase. This package (`@proofchain/agent`) is built and
 * tested BEFORE that phase, so we vendor a small, faithful stand-in here that:
 *   - mirrors the exact type/export contract the agent imports (see below), and
 *   - lets the whole test-suite + `tsc` run with no network and no real API key.
 *
 * At integration time the real `@proofchain/shared` is installed and used at
 * runtime (tsup keeps it external; vitest/tsc are pointed here via alias/paths).
 * The real package MUST export the same names/shapes documented in README.md.
 */
import type { Chain } from 'viem';

// ---------------------------------------------------------------------------
// Verdict types (mirror of SPEC "Verdict types")
// ---------------------------------------------------------------------------

export type FindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface Finding {
  code: string;
  severity: FindingSeverity;
  message: string;
  evidence?: Record<string, unknown>;
}

export interface VerificationVerdict {
  batchId: `0x${string}`;
  score: number; // 0..10000 bps
  passed: boolean;
  threshold: number; // bps used
  findings: Finding[];
  documentHashes: string[];
  verdictURI?: string;
  createdAt: string; // ISO
  model: string;
}

// ---------------------------------------------------------------------------
// Chain config
// ---------------------------------------------------------------------------

export const CHAIN_ID = 11155111 as const;

export const baseSepolia: Chain = {
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sepolia.base.org'] },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' },
  },
  testnet: true,
};

export const ethereumSepolia: Chain = {
  id: 11155111,
  name: 'Sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://ethereum-sepolia-rpc.publicnode.com'] },
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' },
  },
  testnet: true,
};

/** Resolve the viem chain for a supported id, optionally overriding the RPC. */
export const chainForId = (chainId: number, rpcUrl?: string): Chain => {
  const base = chainId === 84532 ? baseSepolia : ethereumSepolia;
  if (rpcUrl === undefined) return base;
  return { ...base, rpcUrls: { ...base.rpcUrls, default: { http: [rpcUrl] } } };
};

// ---------------------------------------------------------------------------
// Contract addresses (per-chain map)
// ---------------------------------------------------------------------------

// Mirrors the REAL `@proofchain/shared` export exactly: keys are the PascalCase
// contract names and every entry is optional (a value is absent until deployed).
export type ContractName =
  | 'ProvenanceRegistry'
  | 'AttestationRegistry'
  | 'SettlementEscrow'
  | 'MockUSDC';

export type ContractAddresses = Readonly<
  Partial<Record<ContractName, `0x${string}`>>
>;

const PLACEHOLDER_ADDRESSES: ContractAddresses = {
  ProvenanceRegistry: '0x1111111111111111111111111111111111111111',
  AttestationRegistry: '0x2222222222222222222222222222222222222222',
  SettlementEscrow: '0x3333333333333333333333333333333333333333',
  MockUSDC: '0x4444444444444444444444444444444444444444',
};

export const CONTRACTS: Record<number, ContractAddresses> = {
  11155111: PLACEHOLDER_ADDRESSES,
  84532: PLACEHOLDER_ADDRESSES,
};

// ---------------------------------------------------------------------------
// ABIs (only the surface the agent reads/writes)
// ---------------------------------------------------------------------------

export const provenanceRegistryAbi = [
  {
    type: 'function',
    name: 'getBatch',
    stateMutability: 'view',
    inputs: [{ name: 'batchId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'batchId', type: 'bytes32' },
          { name: 'supplier', type: 'address' },
          { name: 'originHash', type: 'bytes32' },
          { name: 'metadataURI', type: 'string' },
          { name: 'createdAt', type: 'uint64' },
          { name: 'exists', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getCheckpoints',
    stateMutability: 'view',
    inputs: [{ name: 'batchId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'batchId', type: 'bytes32' },
          { name: 'location', type: 'string' },
          { name: 'timestamp', type: 'uint64' },
          { name: 'dataHash', type: 'bytes32' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'checkpointCount',
    stateMutability: 'view',
    inputs: [{ name: 'batchId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const attestationRegistryAbi = [
  {
    type: 'function',
    name: 'attest',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'batchId', type: 'bytes32' },
      { name: 'score', type: 'uint16' },
      { name: 'verdictHash', type: 'bytes32' },
      { name: 'verdictURI', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getAttestation',
    stateMutability: 'view',
    inputs: [{ name: 'batchId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'batchId', type: 'bytes32' },
          { name: 'score', type: 'uint16' },
          { name: 'verdictHash', type: 'bytes32' },
          { name: 'verdictURI', type: 'string' },
          { name: 'attestedAt', type: 'uint64' },
          { name: 'agent', type: 'address' },
          { name: 'exists', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'isAttested',
    stateMutability: 'view',
    inputs: [{ name: 'batchId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'scoreOf',
    stateMutability: 'view',
    inputs: [{ name: 'batchId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint16' }],
  },
] as const;

export const settlementEscrowAbi = [
  {
    type: 'function',
    name: 'settle',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'batchId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getDeal',
    stateMutability: 'view',
    inputs: [{ name: 'batchId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'batchId', type: 'bytes32' },
          { name: 'buyer', type: 'address' },
          { name: 'supplier', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'state', type: 'uint8' },
        ],
      },
    ],
  },
] as const;
