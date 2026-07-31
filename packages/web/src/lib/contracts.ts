import type { Address } from "viem";
import {
  attestationRegistryAbi,
  mockUsdcAbi,
  provenanceRegistryAbi,
  settlementEscrowAbi,
} from "./abis";
import { contractAddresses } from "./shared";
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

export { contractAddresses };
