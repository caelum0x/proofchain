import { defineChain, type Chain } from "viem";
import {
  baseSepolia as viemBaseSepolia,
  sepolia as viemSepolia,
} from "viem/chains";

/** Ethereum Sepolia — the LIVE default network this system targets. */
export const ETHEREUM_SEPOLIA_CHAIN_ID = 11_155_111 as const;

/** Base Sepolia — still supported for legacy/alternate deployments. */
export const BASE_SEPOLIA_CHAIN_ID = 84_532 as const;

/** Every chain id this system knows how to resolve addresses/config for. */
export const SUPPORTED_CHAIN_IDS = [
  ETHEREUM_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
] as const;

export type ChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

/** The active/default chain when no override is present. */
export const DEFAULT_CHAIN_ID: ChainId = ETHEREUM_SEPOLIA_CHAIN_ID;

/** Env vars that select the active chain (browser + server variants). */
export const PUBLIC_CHAIN_ID_ENV = "NEXT_PUBLIC_CHAIN_ID";
export const CHAIN_ID_ENV = "CHAIN_ID";

/** Env var that overrides the Base Sepolia / generic RPC endpoint. */
export const RPC_URL_ENV = "BASE_SEPOLIA_RPC_URL";
/** Env var that overrides the Ethereum Sepolia RPC endpoint. */
export const ETHEREUM_SEPOLIA_RPC_URL_ENV = "ETHEREUM_SEPOLIA_RPC_URL";

/** Default public RPC used when the Base Sepolia override is not provided. */
export const DEFAULT_BASE_SEPOLIA_RPC = "https://sepolia.base.org";
/** Default public RPC used when the Ethereum Sepolia override is not provided. */
export const DEFAULT_ETHEREUM_SEPOLIA_RPC =
  "https://ethereum-sepolia-rpc.publicnode.com";

/**
 * Read an environment variable in a way that is safe in the browser (where
 * `process` may be undefined) and in Node/serverless runtimes.
 */
export function readEnv(name: string): string | undefined {
  if (typeof process === "undefined" || process.env == null) return undefined;
  const value = process.env[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Narrowing guard for the supported chain ids. */
export function isSupportedChainId(chainId: number): chainId is ChainId {
  return (SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);
}

/**
 * Resolve the active chain id from the environment. Checks the public
 * (browser) variable first, then the server variable, and finally falls back
 * to {@link DEFAULT_CHAIN_ID}. Unsupported values are ignored (fail-safe).
 */
export function resolveChainId(
  env: (name: string) => string | undefined = readEnv,
): ChainId {
  const raw = env(PUBLIC_CHAIN_ID_ENV) ?? env(CHAIN_ID_ENV);
  if (raw !== undefined) {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && isSupportedChainId(parsed)) return parsed;
  }
  return DEFAULT_CHAIN_ID;
}

/**
 * Base Sepolia chain config for viem. If `BASE_SEPOLIA_RPC_URL` is set at
 * import time it becomes the default transport URL; otherwise the public
 * endpoint is used. The rest of the metadata is taken from viem's canonical
 * `baseSepolia` definition so explorers and multicall addresses stay correct.
 */
export function createBaseSepoliaChain(rpcUrl?: string): Chain {
  const url = rpcUrl ?? readEnv(RPC_URL_ENV) ?? DEFAULT_BASE_SEPOLIA_RPC;
  return defineChain({
    ...viemBaseSepolia,
    rpcUrls: {
      ...viemBaseSepolia.rpcUrls,
      default: { http: [url] },
    },
  });
}

/**
 * Ethereum Sepolia chain config for viem. Prefers the Ethereum-specific RPC
 * override, then the generic RPC override, then the public endpoint. Metadata
 * (explorer at https://sepolia.etherscan.io, multicall) comes from viem's
 * canonical `sepolia` definition.
 */
export function createEthereumSepoliaChain(rpcUrl?: string): Chain {
  const url =
    rpcUrl ??
    readEnv(ETHEREUM_SEPOLIA_RPC_URL_ENV) ??
    readEnv(RPC_URL_ENV) ??
    DEFAULT_ETHEREUM_SEPOLIA_RPC;
  return defineChain({
    ...viemSepolia,
    rpcUrls: {
      ...viemSepolia.rpcUrls,
      default: { http: [url] },
    },
  });
}

/** Ready-to-use chain instances resolved from the environment at import time. */
export const baseSepolia = createBaseSepoliaChain();
export const ethereumSepolia = createEthereumSepoliaChain();

/**
 * Return the viem {@link Chain} for a supported chain id, optionally overriding
 * the transport URL. Defaults to the active chain when none is supplied.
 */
export function chainForId(
  chainId: number = CHAIN_ID,
  rpcUrl?: string,
): Chain {
  return chainId === BASE_SEPOLIA_CHAIN_ID
    ? createBaseSepoliaChain(rpcUrl)
    : createEthereumSepoliaChain(rpcUrl);
}

/** The active chain id resolved from the environment at import time. */
export const CHAIN_ID: ChainId = resolveChainId();

/** The active viem chain resolved from the environment at import time. */
export const activeChain: Chain = chainForId(CHAIN_ID);
