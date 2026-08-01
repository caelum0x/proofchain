/**
 * Integration seam for `@proofchain/shared`.
 *
 * This is the ONLY module in the web app that imports from the workspace
 * `@proofchain/shared` package. Per the spec, contract *addresses* and the
 * agent *verdict types* live in `shared`. We validate the address map at the
 * boundary with zod (never trust external data) and expose a small, strongly
 * typed surface to the rest of the app. Keeping the dependency in one file
 * means the integration contract is explicit and easy to adjust.
 */
import type { Address } from "viem";
import { getAddress, isAddress, zeroAddress } from "viem";
import { z } from "zod";

// Contract deployment map, keyed by chainId. Defined in shared/src/addresses.ts.
import { CONTRACTS } from "@proofchain/shared";
// Verdict types shared between the agent output and this UI.
import type { VerificationVerdict, Finding } from "@proofchain/shared";

import { env, BASE_SEPOLIA_CHAIN_ID, ETHEREUM_SEPOLIA_CHAIN_ID } from "./env";
import {
  ALL_CONTRACT_NAMES,
  isContractName,
  type ContractName as PlatformContractName,
} from "./contract-names";
// Bundled deployment manifests (mirror packages/contracts/deployments/*.json).
// Refresh via scripts/gen-abis.sh. Each is a { ContractName: address } map that
// may also carry a numeric `chainId` metadata key (ignored during parsing).
import ethereumSepoliaDeployment from "./deployments/sepolia.json";
import baseSepoliaDeployment from "./deployments/base-sepolia.json";

export type { VerificationVerdict, Finding };

export type ContractName =
  | "ProvenanceRegistry"
  | "AttestationRegistry"
  | "SettlementEscrow"
  | "MockUSDC";

export interface ContractAddresses {
  readonly provenanceRegistry?: Address;
  readonly attestationRegistry?: Address;
  readonly settlementEscrow?: Address;
  readonly mockUsdc?: Address;
}

const addressSchema = z
  .string()
  .refine((v) => isAddress(v), { message: "invalid EVM address" })
  .transform((v) => getAddress(v));

const contractSetSchema = z
  .object({
    ProvenanceRegistry: addressSchema.optional(),
    AttestationRegistry: addressSchema.optional(),
    SettlementEscrow: addressSchema.optional(),
    MockUSDC: addressSchema.optional(),
  })
  .partial();

/** A configured, non-zero address, or undefined if unset/placeholder. */
function normalize(addr?: Address): Address | undefined {
  if (!addr) return undefined;
  return getAddress(addr) === zeroAddress ? undefined : getAddress(addr);
}

/**
 * Resolve the deployed contract addresses for the active chain. Tolerates a
 * missing or placeholder deployment (returns undefined per field) so the UI can
 * render an actionable "not deployed" state instead of crashing.
 */
/** The bundled deployment manifest for a chain (works in the browser bundle). */
function bundledManifestFor(chainId: number): unknown {
  if (chainId === ETHEREUM_SEPOLIA_CHAIN_ID) return ethereumSepoliaDeployment;
  if (chainId === BASE_SEPOLIA_CHAIN_ID) return baseSepoliaDeployment;
  return {};
}

export function resolveContractAddresses(
  chainId: number = env.chainId,
): ContractAddresses {
  // `CONTRACTS` (owned by shared) resolves via a filesystem read, which is empty
  // in the browser bundle — so we layer the bundled manifest underneath as the
  // reliable client-side source, with shared's values winning on top.
  const map = CONTRACTS as unknown as Record<string, unknown>;
  const fromShared = map[String(chainId)] ?? map[chainId as unknown as string];
  const bundled = bundledManifestFor(chainId);
  const forChain = {
    ...(typeof bundled === "object" && bundled ? bundled : {}),
    ...(typeof fromShared === "object" && fromShared ? fromShared : {}),
  };

  const parsed = contractSetSchema.safeParse(forChain ?? {});
  if (!parsed.success) {
    return {};
  }

  return {
    provenanceRegistry: normalize(parsed.data.ProvenanceRegistry),
    attestationRegistry: normalize(parsed.data.AttestationRegistry),
    settlementEscrow: normalize(parsed.data.SettlementEscrow),
    mockUsdc: normalize(parsed.data.MockUSDC),
  };
}

export const contractAddresses: ContractAddresses = resolveContractAddresses();

export const areCoreContractsDeployed =
  Boolean(contractAddresses.provenanceRegistry) &&
  Boolean(contractAddresses.attestationRegistry) &&
  Boolean(contractAddresses.settlementEscrow);

// ───────────────────────────────────────────────────────────────────────────
// Platform-wide address resolution (all ~60 contracts from SPEC2).
//
// The four core contracts continue to resolve through `resolveContractAddresses`
// above (shared `CONTRACTS` + env overrides). Every other module contract is
// resolved from the bundled Base-Sepolia deployment manifest, chain-gated so we
// never surface Base-Sepolia addresses on a mismatched network. Each address is
// validated + checksummed at this boundary — we never trust the raw JSON shape.
// ───────────────────────────────────────────────────────────────────────────

/** All resolved platform addresses, keyed by canonical contract name. */
export type AllContractAddresses = Readonly<Partial<Record<PlatformContractName, Address>>>;

// Tolerant schema: values may be non-strings (e.g. a numeric `chainId` metadata
// key). We accept the whole object and filter to valid string addresses below,
// so a stray metadata field never discards the entire manifest.
const manifestSchema = z.record(z.string(), z.unknown());

/** Parse + checksum the bundled manifest into a validated name→address map. */
function parseManifest(raw: unknown): Partial<Record<PlatformContractName, Address>> {
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) return {};
  const out: Partial<Record<PlatformContractName, Address>> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (!isContractName(key)) continue;
    if (typeof value !== "string" || !isAddress(value)) continue;
    const checksummed = getAddress(value);
    if (checksummed === zeroAddress) continue;
    out[key] = checksummed;
  }
  return out;
}

/**
 * Resolve deployed addresses for EVERY platform contract on the active chain.
 * Layering: bundled manifest (chain-gated) is the base; the four core contracts
 * from `resolveContractAddresses` win on top (they honor env overrides). Returns
 * a partial map — undefined entries mean "not deployed", which the UI renders as
 * an actionable state instead of crashing.
 */
export function resolveAllContractAddresses(
  chainId: number = env.chainId,
): AllContractAddresses {
  const fromManifest =
    chainId === ETHEREUM_SEPOLIA_CHAIN_ID
      ? parseManifest(ethereumSepoliaDeployment)
      : chainId === BASE_SEPOLIA_CHAIN_ID
        ? parseManifest(baseSepoliaDeployment)
        : {};

  const core = resolveContractAddresses(chainId);
  const coreByName: Partial<Record<PlatformContractName, Address>> = {
    ProvenanceRegistry: core.provenanceRegistry,
    AttestationRegistry: core.attestationRegistry,
    SettlementEscrow: core.settlementEscrow,
    MockUSDC: core.mockUsdc,
  };

  const out: Partial<Record<PlatformContractName, Address>> = { ...fromManifest };
  for (const name of ALL_CONTRACT_NAMES) {
    const override = coreByName[name];
    if (override) out[name] = override;
  }
  return Object.freeze(out);
}

/** Memoised resolution for the active chain. */
export const allContractAddresses: AllContractAddresses =
  resolveAllContractAddresses();

/** Non-throwing single lookup by canonical contract name. */
export function getResolvedAddress(name: PlatformContractName): Address | undefined {
  return allContractAddresses[name];
}
