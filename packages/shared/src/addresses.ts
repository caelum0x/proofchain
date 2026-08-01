import { createRequire } from "node:module";

import { getAddress, isAddress } from "viem";
import { z } from "zod";

import { CONTRACT_NAMES, type ContractName } from "./abis/index";
import {
  BASE_SEPOLIA_CHAIN_ID,
  CHAIN_ID,
  ETHEREUM_SEPOLIA_CHAIN_ID,
  SUPPORTED_CHAIN_IDS,
  type ChainId,
  readEnv,
} from "./chains";
import {
  DeploymentParseError,
  InvalidAddressError,
  MissingAddressError,
} from "./errors";
import { AddressSchema, type Address } from "./types";

/** Per-contract resolved addresses (a value is absent until deployed). */
export type ContractAddresses = Readonly<
  Partial<Record<ContractName, Address>>
>;

/**
 * Convert a PascalCase contract name to SCREAMING_SNAKE_CASE, correctly
 * splitting acronym boundaries. Examples:
 *   `MockUSDC`          -> `MOCK_USDC`
 *   `SettlementEscrow`  -> `SETTLEMENT_ESCROW`
 *   `KYCRegistry`       -> `KYC_REGISTRY`
 *   `ProofChainGovernor`-> `PROOF_CHAIN_GOVERNOR`
 */
export function toScreamingSnakeCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/gu, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1_$2")
    .toUpperCase();
}

/**
 * Build the ordered list of env vars that can override a contract's address.
 * Both a plain (server) and `NEXT_PUBLIC_`-prefixed (browser) variant are
 * accepted, e.g. `SETTLEMENT_ESCROW_ADDRESS` and
 * `NEXT_PUBLIC_SETTLEMENT_ESCROW_ADDRESS`.
 */
export function envOverridesFor(name: ContractName): readonly string[] {
  const base = `${toScreamingSnakeCase(name)}_ADDRESS`;
  return Object.freeze([base, `NEXT_PUBLIC_${base}`]);
}

/**
 * Env var overrides per contract, checked before the deployment manifest.
 * Generated from {@link CONTRACT_NAMES} so every contract — including all
 * platform-expansion modules — is overridable without hand-maintaining a table.
 */
const ENV_OVERRIDES: Readonly<Record<ContractName, readonly string[]>> =
  Object.freeze(
    Object.fromEntries(
      CONTRACT_NAMES.map((name) => [name, envOverridesFor(name)] as const),
    ) as Record<ContractName, readonly string[]>,
  );

/** Env var that overrides the deployment manifest file path (active chain). */
export const DEPLOYMENTS_PATH_ENV = "PROOFCHAIN_DEPLOYMENTS_FILE";

/** Default deployment manifest location per supported chain id. */
export const DEFAULT_DEPLOYMENTS_PATHS: Readonly<Record<ChainId, string>> =
  Object.freeze({
    [ETHEREUM_SEPOLIA_CHAIN_ID]: "packages/contracts/deployments/sepolia.json",
    [BASE_SEPOLIA_CHAIN_ID]: "packages/contracts/deployments/base-sepolia.json",
  });

/** Default location of the ACTIVE chain's deployment manifest. */
export const DEFAULT_DEPLOYMENTS_PATH = DEFAULT_DEPLOYMENTS_PATHS[CHAIN_ID];

/**
 * Validate and checksum a raw address string. Throws {@link InvalidAddressError}
 * for anything that is not a well-formed 20-byte EVM address.
 */
export function parseAddress(value: string, label = "address"): Address {
  const parsed = AddressSchema.safeParse(value);
  if (!parsed.success || !isAddress(value)) {
    throw new InvalidAddressError(`Invalid ${label}: ${String(value)}`, {
      value,
    });
  }
  return getAddress(value) as Address;
}

/**
 * Lenient deployment manifest schema. Accepts addresses either at the top level
 * or nested under a `contracts` object, plus optional `chainId`. Unknown keys
 * are ignored so the contracts package can add metadata without breaking us.
 */
const DeploymentManifestSchema = z
  .object({
    chainId: z.number().int().optional(),
    contracts: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

/**
 * Extract the contract addresses from a parsed manifest object. Pure and
 * IO-free so it is fully unit-testable.
 */
export function addressesFromManifest(manifest: unknown): ContractAddresses {
  const parsed = DeploymentManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    throw new DeploymentParseError("Malformed deployment manifest", {
      details: parsed.error.flatten(),
    });
  }

  const flat = parsed.data as Record<string, unknown>;
  const nested = parsed.data.contracts ?? {};

  const out: Partial<Record<ContractName, Address>> = {};
  for (const name of CONTRACT_NAMES) {
    const raw = nested[name] ?? flat[name];
    if (typeof raw === "string" && raw.length > 0) {
      out[name] = parseAddress(raw, name);
    }
  }
  return Object.freeze(out);
}

/**
 * Resolve final addresses by layering sources: env overrides win over the
 * deployment manifest. Pure — inject `env` and `manifest` in tests.
 */
export function resolveContractAddresses(sources: {
  readonly env?: (name: string) => string | undefined;
  readonly manifest?: unknown;
}): ContractAddresses {
  const env = sources.env ?? readEnv;
  const fromManifest =
    sources.manifest === undefined || sources.manifest === null
      ? {}
      : addressesFromManifest(sources.manifest);

  const out: Partial<Record<ContractName, Address>> = { ...fromManifest };
  for (const name of CONTRACT_NAMES) {
    for (const varName of ENV_OVERRIDES[name]) {
      const value = env(varName);
      if (value !== undefined) {
        out[name] = parseAddress(value, `${name} (${varName})`);
        break;
      }
    }
  }
  return Object.freeze(out);
}

/**
 * Read and JSON-parse the deployment manifest from disk. Returns `null` when
 * the file is absent or unreadable (e.g. browser bundles), so callers degrade
 * gracefully. Never throws for the file-absent case.
 *
 * The `node:fs`/`node:module` built-ins are marked external at build time and
 * are only touched inside the Node runtime guard, so browser consumers (which
 * supply addresses via the `NEXT_PUBLIC_*` env overrides) are unaffected.
 */
export function readDeploymentManifest(path?: string): unknown | null {
  // Only attempt filesystem access in Node-like runtimes.
  if (typeof process === "undefined" || process.versions?.node == null) {
    return null;
  }
  const filePath = path ?? readEnv(DEPLOYMENTS_PATH_ENV) ?? DEFAULT_DEPLOYMENTS_PATH;
  const fs = loadNodeFs();
  if (fs == null) return null;
  try {
    if (!fs.existsSync(filePath)) return null;
    const contents = fs.readFileSync(filePath, "utf8");
    return JSON.parse(contents) as unknown;
  } catch {
    // Unreadable / invalid JSON: degrade gracefully.
    return null;
  }
}

/**
 * Resolve the Node `fs` module via `createRequire` so the dependency stays out
 * of browser bundles unless actually invoked. Returns `null` when unavailable.
 */
function loadNodeFs(): typeof import("node:fs") | null {
  try {
    const url = (import.meta as { url?: string }).url;
    if (typeof url !== "string") return null;
    const require = createRequire(url);
    return require("node:fs") as typeof import("node:fs");
  } catch {
    return null;
  }
}

/**
 * Read the deployment manifest for a specific chain id. The active chain honors
 * the {@link DEPLOYMENTS_PATH_ENV} override (via {@link readDeploymentManifest});
 * other chains fall back to their canonical default path. Returns `null` when
 * the file is absent (graceful degradation — e.g. browser bundles).
 */
export function readDeploymentManifestForChain(
  chainId: ChainId,
): unknown | null {
  if (chainId === CHAIN_ID) return readDeploymentManifest();
  return readDeploymentManifest(DEFAULT_DEPLOYMENTS_PATHS[chainId]);
}

/**
 * The typed contract address map keyed by chain id. Resolved once at import
 * time from env overrides + the on-disk manifest (when present). Every
 * supported chain gets an entry (Ethereum Sepolia ← sepolia.json, Base Sepolia
 * ← base-sepolia.json); env overrides apply to whichever chain is active.
 */
export const CONTRACTS: Readonly<Record<ChainId, ContractAddresses>> =
  Object.freeze(
    Object.fromEntries(
      SUPPORTED_CHAIN_IDS.map((chainId) => [
        chainId,
        resolveContractAddresses({
          manifest: readDeploymentManifestForChain(chainId),
        }),
      ]),
    ) as Record<ChainId, ContractAddresses>,
  );

/**
 * Get a required contract address for a chain, throwing a structured
 * {@link MissingAddressError} when it has not been configured/deployed.
 */
export function getContractAddress(
  name: ContractName,
  chainId: number = CHAIN_ID,
): Address {
  const forChain = CONTRACTS[chainId as ChainId];
  const address = forChain?.[name];
  if (address === undefined) {
    throw new MissingAddressError(
      `Address for ${name} on chain ${chainId} is not configured. ` +
        `Set the corresponding env override or deploy the contracts.`,
      { name, chainId, envVars: ENV_OVERRIDES[name] },
    );
  }
  return address;
}

/** Non-throwing lookup: returns `undefined` when unconfigured. */
export function tryGetContractAddress(
  name: ContractName,
  chainId: number = CHAIN_ID,
): Address | undefined {
  return CONTRACTS[chainId as ChainId]?.[name];
}
