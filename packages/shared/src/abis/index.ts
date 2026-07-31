import type { Abi } from "viem";

import attestationRegistryJson from "./AttestationRegistry.json";
import mockUsdcJson from "./MockUSDC.json";
import provenanceRegistryJson from "./ProvenanceRegistry.json";
import settlementEscrowJson from "./SettlementEscrow.json";

/**
 * The four ProofChain contract ABIs.
 *
 * These JSON files are placeholders that mirror the events/functions defined in
 * the master spec so this package typechecks and tests standalone. During the
 * integration phase the `@proofchain/contracts` build overwrites the JSON files
 * with the compiled, authoritative ABIs. Because this module re-exports them as
 * the generic `Abi` type, downstream code keeps working across that swap.
 */
export const provenanceRegistryAbi = provenanceRegistryJson as Abi;
export const attestationRegistryAbi = attestationRegistryJson as Abi;
export const settlementEscrowAbi = settlementEscrowJson as Abi;
export const mockUsdcAbi = mockUsdcJson as Abi;

/** Canonical contract names used as keys across the shared package. */
export const CONTRACT_NAMES = [
  "ProvenanceRegistry",
  "AttestationRegistry",
  "SettlementEscrow",
  "MockUSDC",
] as const;

export type ContractName = (typeof CONTRACT_NAMES)[number];

/** Map of contract name to its ABI. */
export const ABIS: Readonly<Record<ContractName, Abi>> = Object.freeze({
  ProvenanceRegistry: provenanceRegistryAbi,
  AttestationRegistry: attestationRegistryAbi,
  SettlementEscrow: settlementEscrowAbi,
  MockUSDC: mockUsdcAbi,
});

/** Type guard: is `value` one of the known contract names? */
export function isContractName(value: unknown): value is ContractName {
  return (
    typeof value === "string" &&
    (CONTRACT_NAMES as readonly string[]).includes(value)
  );
}
