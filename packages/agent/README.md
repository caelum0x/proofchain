# @proofchain/agent

The ProofChain **AI verification agent**: a production Fastify service that
inspects a shipment's documents, cross-checks them against the on-chain
provenance trail, scores fraud/anomaly risk, writes a signed attestation
on-chain, and (optionally) triggers escrow settlement.

Part of the [ProofChain](../../docs/SPEC.md) monorepo. Consumes types, ABIs and
addresses from `@proofchain/shared`.

---

## What it does

For each `POST /verify` request the pipeline:

1. **Reads on-chain provenance** for the batch (viem → `ProvenanceRegistry`).
2. **Idempotency guard** — if the batch is already attested, returns the
   existing verdict without re-attesting.
3. **Parses documents** (invoice, bill of lading) into structured fields using a
   Claude vision sub-step.
4. **Runs a Claude tool-calling loop** with four tools —
   `get_provenance`, `parse_document`, `record_finding`, `finalize_verdict`.
   The orchestrator enforces a **max iteration count** and a **wall-clock
   timeout**, and **fails closed** (strict score 0) if the model never
   finalizes.
5. **Runs deterministic cross-check rules** (invoice totals, line-item math,
   origin-hash match, quantity/supplier consistency, provenance presence,
   checkpoint ordering, date consistency).
6. **Reconciles the score deterministically**: it recomputes a rule-based score
   from finding severities and takes the **stricter (lower) of model vs rules**.
   This makes a *passing* verdict reproducible and prevents a nondeterministic
   model from waving through fraud. A single `critical` finding forces a hard
   fail (score 0).
7. **Pins the verdict JSON to IPFS** (Pinata, or a local `ipfs://mock/<sha256>`
   fallback) and **attests on-chain** (`attest()` with `AGENT_PRIVATE_KEY`).
8. **Optionally settles** (`settle()`) when `SETTLE_ON_ATTEST=true` (fail-soft —
   a settle error never invalidates the recorded attestation).

### Scoring model

Rule score starts at `10000` bps and subtracts a fixed penalty per finding:

| severity | penalty (bps) |
| -------- | ------------- |
| info     | 0             |
| low      | 300           |
| medium   | 1000          |
| high     | 3000          |
| critical | forces 0      |

`finalScore = min(modelScore, ruleScore)`, `passed = finalScore >= threshold`
(default threshold `7000`).

---

## API

All responses use the envelope `{ success, data, error }`.

### `POST /verify`
```jsonc
// request
{
  "batchId": "0x<64 hex>",
  "documents": [
    { "name": "invoice.pdf", "mimeType": "application/pdf", "dataBase64": "..." }
    // or { "name": "...", "mimeType": "...", "url": "https://..." }
  ]
}
// response.data
{
  "jobId": "uuid",
  "verdict": { "batchId", "score", "passed", "threshold", "findings",
               "documentHashes", "verdictURI", "createdAt", "model" },
  "txHash": "0x...",
  "settleTxHash": "0x...",      // only when SETTLE_ON_ATTEST=true
  "alreadyAttested": false
}
```

### `GET /health`
Readiness probe. `200` when the RPC/chain is reachable, `503` when degraded.
Reports `chainId` and the agent signer address.

### `GET /jobs/:id`
Status of a verification job (`pending | running | completed | failed`) with its
result or structured error.

Every request body is validated with **zod**; rate limiting is applied per IP
(`@fastify/rate-limit`); logging is structured (**pino**) with secret redaction.

---

## Setup

```bash
cp .env.example .env   # fill in ANTHROPIC_API_KEY, AGENT_PRIVATE_KEY, BASE_SEPOLIA_RPC_URL
pnpm install           # done once at the monorepo root during integration
```

### Scripts

| script      | description                                        |
| ----------- | -------------------------------------------------- |
| `dev`       | Run with hot reload (`tsx watch`).                 |
| `build`     | Bundle to `dist/` (`tsup`, ESM).                   |
| `start`     | Run the built server (`node dist/index.js`).       |
| `test`      | Run the vitest suite (offline, no key/network).    |
| `typecheck` | `tsc --noEmit`.                                     |

---

## Environment variables

See [`.env.example`](./.env.example) for the full annotated list. Required:
`ANTHROPIC_API_KEY`, `AGENT_PRIVATE_KEY`, `BASE_SEPOLIA_RPC_URL`. The service
validates all env at startup and **fails fast** with a `CONFIG_ERROR` listing
every problem. No secret is ever hardcoded.

---

## Architecture & testability

Every external dependency is behind an **injectable interface**, so the pipeline
is fully unit-testable with mocks:

- `AnthropicClient` (`src/anthropic/client.ts`) — the only real implementation
  (`real-client.ts`) wraps `@anthropic-ai/sdk`.
- `ChainClient` (`src/chain/client.ts`) — `viem-client.ts` wraps viem public +
  wallet clients.
- `DocumentParser`, `VerdictPinner`, `JobStore` — all interface-first.

`src/index.ts` is a thin composition root; all logic lives in small, focused,
immutable modules.

### `@proofchain/shared` coupling

At runtime this package imports types/ABIs/addresses from the `@proofchain/shared`
workspace package (`"workspace:*"`), re-exported through the single boundary
file `src/shared.ts`. Because `shared` is assembled during the monorepo
integration phase, the tests and typecheck here resolve `@proofchain/shared` to a
faithful in-package double at `test/doubles/shared.ts` (via the vitest alias and
`tsconfig` path). **The real `@proofchain/shared` must export the same names/shapes
documented in that double** — that is the integration contract.

### Tests

```bash
pnpm test
```

Runs with **no API key and no network**. Suites cover: score reconciliation
(model vs rules), every cross-check rule, the orchestrator (happy path, fail-
closed, timeout, invalid tool input), the `/verify` handler with a mocked
Anthropic client and mocked chain (including the deterministic guard and
idempotency), zod validation failures, and env validation.
