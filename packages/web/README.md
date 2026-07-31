# @proofchain/web

Production Next.js (App Router) dApp for **ProofChain** — AI-verified supply-chain
provenance with autonomous on-chain settlement on **Base Sepolia**.

It provides four flows:

- **Supplier** — register provenance batches, append checkpoints, upload shipment
  documents, and request AI verification via the agent API.
- **Buyer** — mint test MockUSDC, approve the escrow, fund a deal, and track settlement.
- **Verifier dashboard** — a live table of every batch: provenance trail, attestation
  score, findings (loaded from the pinned `verdictURI`), and settlement state, updated
  in real time via wagmi watch + contract-event subscriptions.
- **Deal detail** — the full timeline (registered → checkpoints → attested →
  settled / disputed / refunded) with Base Sepolia explorer links, plus settle/refund
  actions.

No private keys ever touch the browser — every write is signed in the user's wallet, and
the AI agent attests with its own signer server-side.

## Tech stack

- Next.js 15 (App Router) + React 19, TypeScript strict mode
- `wagmi` + `viem` + `@rainbow-me/rainbowkit` for wallet + chain access
- `@tanstack/react-query` for async cache
- `zod` + `react-hook-form` for validated forms
- `sonner` for transaction toasts
- Tailwind CSS for styling
- Vitest + Testing Library for tests

Contract ABIs are declared as typed viem constants in `src/lib/abis.ts`. Contract
**addresses** and the agent **verdict types** are imported from
[`@proofchain/shared`](../shared) — the single integration seam lives in
`src/lib/shared.ts`.

## Setup

```bash
# from the repo root (installs all workspace packages once)
pnpm install

# configure environment
cp packages/web/.env.example packages/web/.env.local
# then fill in the values (see below)
```

## Scripts

| Script              | Description                                  |
| ------------------- | -------------------------------------------- |
| `pnpm dev`          | Start the dev server (http://localhost:3000) |
| `pnpm build`        | Production build (`next build`)              |
| `pnpm start`        | Serve the production build                   |
| `pnpm lint`         | ESLint (`next lint`)                         |
| `pnpm typecheck`    | `tsc --noEmit` (strict)                      |
| `pnpm test`         | Run the Vitest suite                         |
| `pnpm test:coverage`| Run tests with V8 coverage                   |

Run these from `packages/web` (e.g. `pnpm --filter @proofchain/web dev`).

## Environment variables

All are `NEXT_PUBLIC_*` and exposed to the browser — **never put secrets here**.
Values are validated with zod at startup; misconfiguration renders an in-app banner
instead of crashing the build.

| Variable                       | Required | Description                                                        |
| ------------------------------ | -------- | ------------------------------------------------------------------ |
| `NEXT_PUBLIC_WALLETCONNECT_ID` | yes      | WalletConnect Cloud project id (RainbowKit).                       |
| `NEXT_PUBLIC_AGENT_API_URL`    | yes      | Base URL of the `@proofchain/agent` verification API.              |
| `NEXT_PUBLIC_CHAIN_ID`         | yes      | Target chain id. Base Sepolia = `84532`.                           |
| `NEXT_PUBLIC_DEPLOY_BLOCK`     | no       | Block the contracts were deployed at (bounds historical log scan). |
| `NEXT_PUBLIC_RPC_URL`          | no       | Override the read RPC endpoint. Defaults to viem's public RPC.     |

See [`.env.example`](./.env.example).

## Architecture notes

- **Boundaries are validated.** Every form uses a zod schema (`src/lib/schemas.ts`);
  every external response (agent API, verdict JSON, shared address map) is parsed with
  zod before use. Human-friendly labels are hashed to on-chain `bytes32` ids in
  `src/lib/hashing.ts`.
- **Errors are never swallowed.** `src/lib/errors.ts` maps viem revert / user-rejection
  errors and known Solidity custom errors to user-facing copy inside a structured
  `{ success, data, error }` envelope.
- **Transaction UX.** `src/hooks/useTx.ts` drives every write through signing → pending →
  confirmed, surfacing each phase as a toast with an explorer link.
- **Real-time.** `useBatches`, `useBatchDetail`, `useUsdc`, and `useTimeline` back-fill
  historical logs and subscribe to contract events for live updates.
- **Network guard.** The app targets Base Sepolia; a banner and gated actions prompt the
  user to switch networks.

## Testing

Unit tests cover the pure, high-value logic: formatting, hashing, amount parsing,
zod schemas, error mapping, tuple decoders, and the agent/verdict clients (with a mocked
`fetch`). Run `pnpm test`.

## Contract wiring

If the verifier/detail screens show "not deployed", the shared address map has no (or a
zero) address for the active chain. Deploy `@proofchain/contracts`, export the addresses
into `@proofchain/shared`, and reload.
