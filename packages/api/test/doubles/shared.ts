/**
 * Deterministic in-package double for `@proofchain/shared`.
 *
 * Keeps the API package independently testable: no real ABIs, no RPC, no
 * deployment manifest. It mirrors ONLY the surface the API imports
 * (`ABIS`, `CONTRACT_NAMES`, `createBaseSepoliaChain`, `tryGetContractAddress`,
 * and the `ContractName` type) with the SAME shapes the real package exports.
 * The vitest + tsconfig aliases point at this file; the production build
 * resolves the real package.
 */
import type { Abi, Chain } from 'viem';

export type ContractName =
  | 'ProvenanceRegistry'
  | 'AttestationRegistry'
  | 'SettlementEscrow'
  | 'MockUSDC';

export const CONTRACT_NAMES: readonly ContractName[] = [
  'ProvenanceRegistry',
  'AttestationRegistry',
  'SettlementEscrow',
  'MockUSDC',
];

/** Minimal ABI with the SettlementEscrow lifecycle events the tests decode. */
const settlementEscrowAbi: Abi = [
  {
    type: 'event',
    name: 'Funded',
    inputs: [
      { name: 'batchId', type: 'bytes32', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'supplier', type: 'address', indexed: false },
      { name: 'token', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Released',
    inputs: [
      { name: 'batchId', type: 'bytes32', indexed: true },
      { name: 'supplier', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
];

export const ABIS: Readonly<Record<ContractName, Abi>> = {
  ProvenanceRegistry: [],
  AttestationRegistry: [],
  SettlementEscrow: settlementEscrowAbi,
  MockUSDC: [],
};

/** Test addresses. Only SettlementEscrow is "deployed" so `sources()` is non-empty. */
const ADDRESSES: Partial<Record<ContractName, `0x${string}`>> = {
  SettlementEscrow: '0x00000000000000000000000000000000000000e5',
};

export const tryGetContractAddress = (
  name: ContractName,
  _chainId?: number,
): `0x${string}` | undefined => ADDRESSES[name];

export const createBaseSepoliaChain = (_rpcUrl?: string): Chain => ({
  id: 84_532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://sepolia.base.org'] } },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' },
  },
  testnet: true,
});

const ethereumSepolia: Chain = {
  id: 11_155_111,
  name: 'Sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://ethereum-sepolia-rpc.publicnode.com'] } },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' },
  },
  testnet: true,
};

export const chainForId = (chainId?: number, rpcUrl?: string): Chain => {
  const base = chainId === 84_532 ? createBaseSepoliaChain() : ethereumSepolia;
  if (rpcUrl === undefined) return base;
  return { ...base, rpcUrls: { ...base.rpcUrls, default: { http: [rpcUrl] } } };
};
