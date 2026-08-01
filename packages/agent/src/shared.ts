/**
 * Single import boundary for the `@proofchain/shared` workspace package.
 *
 * Every other module in this package imports shared types, ABIs, addresses and
 * chain config from HERE (never directly from `@proofchain/shared`). This keeps
 * the coupling to the shared package in one place: if the integrator finds the
 * real shared package exports different names, this is the only file to adjust.
 *
 * During local dev/test/typecheck, `@proofchain/shared` resolves to
 * test/doubles/shared.ts (see vitest.config.ts alias + tsconfig paths).
 */
export type {
  Finding,
  FindingSeverity,
  VerificationVerdict,
  ContractAddresses,
} from '@proofchain/shared';

export {
  CHAIN_ID,
  CONTRACTS,
  baseSepolia,
  ethereumSepolia,
  chainForId,
  provenanceRegistryAbi,
  attestationRegistryAbi,
  settlementEscrowAbi,
} from '@proofchain/shared';
