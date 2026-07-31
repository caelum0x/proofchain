# @proofchain/shared

The typed contract layer for **ProofChain**, consumed by the `@proofchain/agent`
and `@proofchain/web` packages. It centralizes everything the off-chain code
needs to talk to the on-chain contracts, with strict typing, runtime validation
(zod), and structured error handling. **No secrets live here.**

## What it provides

| Module            | Exports                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `src/types.ts`    | TS mirrors of on-chain structs (`Batch`, `Checkpoint`, `Attestation`, `Deal`, `DealState`), the `VerificationVerdict` / `Finding` interfaces, and zod schemas for runtime validation. |
| `src/chains.ts`   | Base Sepolia (`chainId = 84532`) viem chain config with an env-driven RPC override.                 |
| `src/abis/`       | The four contract ABIs (`ProvenanceRegistry`, `AttestationRegistry`, `SettlementEscrow`, `MockUSDC`) plus an `ABIS` map. |
| `src/addresses.ts`| Reads `packages/contracts/deployments/base-sepolia.json` (with env overrides), exposes the typed `CONTRACTS[chainId]` map, and `getContractAddress` / `tryGetContractAddress`. |
| `src/decoders.ts` | viem-based event-decoder helpers (`decodeProofchainLog`, `decodeContractEvent`, `parseContractLogs`, ...). |
| `src/errors.ts`   | `ProofchainError` hierarchy, the `{ success, data, error }` `Result` envelope, and `toErrorEnvelope`. |

Everything is re-exported from `src/index.ts`.

## Install & build

This package is part of the pnpm workspace. From the repo root (integration
phase installs once):

```bash
pnpm install
pnpm --filter @proofchain/shared build
```

Standalone (within this directory):

```bash
npm install   # or pnpm install at the workspace root
npm run build
```

## Scripts

| Script            | Description                                        |
| ----------------- | -------------------------------------------------- |
| `build`           | Bundle to `dist/` (ESM + `.d.ts`) with tsup.       |
| `dev`             | tsup in watch mode.                                |
| `typecheck`       | `tsc --noEmit` (strict mode).                      |
| `lint`            | Alias for `typecheck`.                             |
| `test`            | Run the vitest suite once.                         |
| `test:watch`      | vitest in watch mode.                              |
| `test:coverage`   | vitest with v8 coverage report.                    |

## Environment variables

All variables are **optional**; the package degrades gracefully when they are
absent. See [`.env.example`](./.env.example) for the full list.

| Variable                          | Purpose                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `BASE_SEPOLIA_RPC_URL`            | RPC endpoint for the exported `baseSepolia` chain. Defaults to the public `https://sepolia.base.org`. |
| `PROVENANCE_REGISTRY_ADDRESS` (+ `NEXT_PUBLIC_` form) | Override the deployed `ProvenanceRegistry` address. |
| `ATTESTATION_REGISTRY_ADDRESS` (+ `NEXT_PUBLIC_` form) | Override the deployed `AttestationRegistry` address. |
| `SETTLEMENT_ESCROW_ADDRESS` (+ `NEXT_PUBLIC_` form)   | Override the deployed `SettlementEscrow` address. |
| `MOCK_USDC_ADDRESS` (+ `NEXT_PUBLIC_` form)          | Override the deployed `MockUSDC` address. |
| `PROOFCHAIN_DEPLOYMENTS_FILE`     | Path to the deployment manifest (defaults to `packages/contracts/deployments/base-sepolia.json`). |

Env overrides win over the on-disk deployment manifest. In browser bundles the
manifest file cannot be read, so the `NEXT_PUBLIC_*` overrides are the intended
source of addresses there.

## Usage

```ts
import {
  ABIS,
  CONTRACTS,
  baseSepolia,
  decodeProofchainLog,
  getContractAddress,
  VerificationVerdictSchema,
} from "@proofchain/shared";
import { createPublicClient, http } from "viem";

const client = createPublicClient({ chain: baseSepolia, transport: http() });

// Typed address lookup (throws MissingAddressError if undeployed).
const registry = getContractAddress("ProvenanceRegistry");

// Decode any ProofChain event log.
const event = decodeProofchainLog(log); // { contract, eventName, args }

// Validate an agent verdict at the boundary.
const verdict = VerificationVerdictSchema.parse(rawVerdict);
```

## Error handling

Failures raise a `ProofchainError` subclass (`ValidationError`,
`MissingAddressError`, `InvalidAddressError`, `DecodeError`,
`DeploymentParseError`), each carrying a stable `code` and optional `details`.
Use `toErrorEnvelope(err)` or the `Result` helpers (`ok` / `fail`) to produce
the serializable `{ success, data, error }` envelope used across the system.

## Notes on ABIs

`src/abis/*.json` are the compiled contract ABIs. During integration the
`@proofchain/contracts` build overwrites these files with the authoritative
ABIs; because this package re-exports them as viem's generic `Abi` type, the
rest of the code and its tests keep working across that swap.
