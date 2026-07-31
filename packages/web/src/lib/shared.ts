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

import { env } from "./env";

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
export function resolveContractAddresses(
  chainId: number = env.chainId,
): ContractAddresses {
  // `CONTRACTS` shape is owned by shared; validate defensively rather than
  // trusting its compile-time type across the package boundary.
  const map = CONTRACTS as unknown as Record<string, unknown>;
  const forChain = map[String(chainId)] ?? map[chainId as unknown as string];

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
