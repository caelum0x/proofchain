import { defineChain } from "viem";
import { baseSepolia as viemBaseSepolia } from "viem/chains";

/** The single chain this system targets. */
export const CHAIN_ID = 84532 as const;
export type ChainId = typeof CHAIN_ID;

/** Env var that overrides the default public RPC endpoint. */
export const RPC_URL_ENV = "BASE_SEPOLIA_RPC_URL";

/** Default public RPC used when {@link RPC_URL_ENV} is not provided. */
export const DEFAULT_BASE_SEPOLIA_RPC = "https://sepolia.base.org";

/**
 * Read an environment variable in a way that is safe in the browser (where
 * `process` may be undefined) and in Node/serverless runtimes.
 */
export function readEnv(name: string): string | undefined {
  if (typeof process === "undefined" || process.env == null) return undefined;
  const value = process.env[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Base Sepolia chain config for viem. If `BASE_SEPOLIA_RPC_URL` is set at
 * import time it becomes the default transport URL; otherwise the public
 * endpoint is used. The rest of the metadata is taken from viem's canonical
 * `baseSepolia` definition so explorers and multicall addresses stay correct.
 */
export function createBaseSepoliaChain(rpcUrl?: string) {
  const url = rpcUrl ?? readEnv(RPC_URL_ENV) ?? DEFAULT_BASE_SEPOLIA_RPC;
  return defineChain({
    ...viemBaseSepolia,
    rpcUrls: {
      ...viemBaseSepolia.rpcUrls,
      default: { http: [url] },
    },
  });
}

/** Ready-to-use chain instance resolved from the environment at import time. */
export const baseSepolia = createBaseSepoliaChain();

/** Narrowing guard for the supported chain id. */
export function isSupportedChainId(chainId: number): chainId is ChainId {
  return chainId === CHAIN_ID;
}
