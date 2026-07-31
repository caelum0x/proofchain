import type { Abi, Address } from "viem";
import {
  attestationRegistryAbi,
  getAbi,
  mockUsdcAbi,
  provenanceRegistryAbi,
  settlementEscrowAbi,
} from "./abis";
import { contractAddresses, getResolvedAddress } from "./shared";
import { ALL_CONTRACT_NAMES, type ContractName } from "./contract-names";
import { AppError } from "./errors";

/**
 * Bundles a validated contract address with its ABI for wagmi read/write calls.
 * Throws a clear AppError if a contract is not deployed on the active chain so
 * callers can render an actionable message instead of a silent failure.
 */

export interface ContractRef<TAbi> {
  readonly address: Address;
  readonly abi: TAbi;
}

function require_(address: Address | undefined, name: string): Address {
  if (!address) {
    throw new AppError(
      "CONTRACT_NOT_DEPLOYED",
      `${name} is not deployed on the configured network. Deploy the contracts and update @proofchain/shared addresses.`,
    );
  }
  return address;
}

export function provenanceContract(): ContractRef<typeof provenanceRegistryAbi> {
  return {
    address: require_(contractAddresses.provenanceRegistry, "ProvenanceRegistry"),
    abi: provenanceRegistryAbi,
  };
}

export function attestationContract(): ContractRef<typeof attestationRegistryAbi> {
  return {
    address: require_(contractAddresses.attestationRegistry, "AttestationRegistry"),
    abi: attestationRegistryAbi,
  };
}

export function escrowContract(): ContractRef<typeof settlementEscrowAbi> {
  return {
    address: require_(contractAddresses.settlementEscrow, "SettlementEscrow"),
    abi: settlementEscrowAbi,
  };
}

export function usdcContract(): ContractRef<typeof mockUsdcAbi> {
  return {
    address: require_(contractAddresses.mockUsdc, "MockUSDC"),
    abi: mockUsdcAbi,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Generic, name-keyed access for every platform contract (SPEC2 M0–M10).
//
// Page agents use these to read/write any module contract via wagmi without
// wiring ABIs/addresses themselves. Prefer the typed helpers above for the four
// core contracts (better inference); use `contractRef(name)` for the rest.
// ───────────────────────────────────────────────────────────────────────────

/** True when a contract has a resolved (deployed + configured) address. */
export function isContractDeployed(name: ContractName): boolean {
  return getResolvedAddress(name) !== undefined;
}

/**
 * Resolve a `{ address, abi }` ref for any platform contract by name. Throws a
 * structured {@link AppError} when the contract is not deployed/configured, so
 * callers can render an actionable message instead of a silent failure.
 */
export function contractRef(name: ContractName): ContractRef<Abi> {
  return {
    address: require_(getResolvedAddress(name), name),
    abi: getAbi(name),
  };
}

/**
 * Non-throwing variant: returns `undefined` when the contract is not deployed.
 * Useful for `enabled`-gated wagmi reads and conditional UI.
 */
export function tryContractRef(name: ContractName): ContractRef<Abi> | undefined {
  const address = getResolvedAddress(name);
  if (!address) return undefined;
  return { address, abi: getAbi(name) };
}

/** A snapshot of which platform contracts are currently deployed. */
export function deployedContracts(): Readonly<Record<ContractName, boolean>> {
  const out = {} as Record<ContractName, boolean>;
  for (const name of ALL_CONTRACT_NAMES) {
    out[name] = isContractDeployed(name);
  }
  return out;
}

export { contractAddresses };
export { ALL_CONTRACT_NAMES, type ContractName } from "./contract-names";
