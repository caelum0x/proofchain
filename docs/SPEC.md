# ProofChain — Master Build Spec (Source of Truth)

> Every package is built against THIS document. Do not deviate from the interfaces,
> names, events, or types defined here. If something is ambiguous, prefer the choice
> that keeps packages loosely coupled and independently testable.

## Product

**ProofChain** — AI-verified supply-chain provenance with autonomous on-chain settlement.
An AI verification agent inspects a shipment's documents, cross-checks them against an
on-chain provenance trail, scores fraud/anomaly risk, writes a signed attestation
on-chain, and — for clean shipments — triggers escrow to release stablecoin (USDC)
payment to the supplier. Fraudulent shipments are held and flagged for dispute.

This is a **production** build, not an MVP or demo. That means: comprehensive error
handling, input validation at every boundary, no hardcoded secrets, tests with real
coverage, access control on contracts, reentrancy protection, structured logging,
graceful degradation, and clear operational docs.

## Target chain

- **Base Sepolia** (chainId `84532`).
- RPC via env `BASE_SEPOLIA_RPC_URL`.
- USDC: use a deployable **MockUSDC** (ERC20, 6 decimals) for test networks so the flow
  is self-contained; the `SettlementEscrow` accepts any ERC20 token address via
  constructor so real USDC can be swapped in on mainnet.

## Monorepo layout

```
packages/
  contracts/   @proofchain/contracts   Foundry — Solidity contracts + tests + deploy
  shared/      @proofchain/shared       TS — types, ABIs, addresses, event decoders
  agent/       @proofchain/agent        TS — Claude verification agent service (API)
  web/         @proofchain/web          Next.js dApp (wallet + dashboards)
  infra/       @proofchain/infra        Supabase schema, IPFS pinning, deploy scripts
```

Package dependency direction (never circular):
`contracts` → (produces ABIs consumed by) → `shared` → `agent`, `web`. `infra` is standalone.

---

## Contracts (package: contracts, Foundry, Solidity ^0.8.24)

Use OpenZeppelin (`@openzeppelin/contracts`): `AccessControl`, `SafeERC20`,
`ReentrancyGuard`, `Pausable`. Install via `forge install`. Solc via `solc` in foundry.toml.
All state-changing functions emit events. All external inputs validated with custom errors.

### 1. `ProvenanceRegistry`
Append-only record of shipment batches and their checkpoints (the "ground truth").

- Roles: `DEFAULT_ADMIN_ROLE`, `REGISTRAR_ROLE` (suppliers/carriers who can register/append).
- Struct `Batch { bytes32 batchId; address supplier; bytes32 originHash; string metadataURI; uint64 createdAt; bool exists; }`
- Struct `Checkpoint { bytes32 batchId; string location; uint64 timestamp; bytes32 dataHash; }`
- `registerBatch(bytes32 batchId, bytes32 originHash, string metadataURI)` — reverts `BatchExists` if already registered; caller must have `REGISTRAR_ROLE`; sets supplier = msg.sender.
- `addCheckpoint(bytes32 batchId, string location, uint64 timestamp, bytes32 dataHash)` — reverts `UnknownBatch` if not registered; append-only.
- Views: `getBatch(bytes32) returns (Batch)`, `getCheckpoints(bytes32) returns (Checkpoint[])`, `checkpointCount(bytes32) returns (uint256)`.
- Events: `BatchRegistered(bytes32 indexed batchId, address indexed supplier, bytes32 originHash, string metadataURI)`, `CheckpointAdded(bytes32 indexed batchId, string location, uint64 timestamp, bytes32 dataHash)`.
- Errors: `BatchExists(bytes32)`, `UnknownBatch(bytes32)`, `EmptyMetadata()`.

### 2. `AttestationRegistry`
Stores AI-agent verdicts. Only the authorized agent signer may attest.

- Roles: `DEFAULT_ADMIN_ROLE`, `AGENT_ROLE` (the verification agent's keypair).
- `score` is a `uint16` in basis points 0–10000 (e.g. 9600 = 0.96).
- Struct `Attestation { bytes32 batchId; uint16 score; bytes32 verdictHash; string verdictURI; uint64 attestedAt; address agent; bool exists; }`
- `attest(bytes32 batchId, uint16 score, bytes32 verdictHash, string verdictURI)` — caller must have `AGENT_ROLE`; reverts `InvalidScore` if score > 10000; reverts `AlreadyAttested` if an attestation for batchId exists (attestations are immutable; re-verification writes a new versioned batchId key is out of scope — one attestation per batch).
- Views: `getAttestation(bytes32) returns (Attestation)`, `isAttested(bytes32) returns (bool)`, `scoreOf(bytes32) returns (uint16)`.
- Events: `Attested(bytes32 indexed batchId, uint16 score, bytes32 verdictHash, string verdictURI, address indexed agent)`.
- Errors: `InvalidScore(uint16)`, `AlreadyAttested(bytes32)`, `NotAttested(bytes32)`.

### 3. `SettlementEscrow`
Holds buyer funds; releases to supplier only when a passing attestation exists.

- Uses `SafeERC20`, `ReentrancyGuard`, `Pausable`. Reads `AttestationRegistry` and `ProvenanceRegistry` (addresses set in constructor).
- Configurable `passThreshold` (uint16 bps, default 7000) settable by admin via `setPassThreshold`.
- Struct `Deal { bytes32 batchId; address buyer; address supplier; address token; uint256 amount; DealState state; }`
- `enum DealState { None, Funded, Released, Refunded, Disputed }`
- `fund(bytes32 batchId, address supplier, address token, uint256 amount)` — buyer must `approve` first; pulls funds via `safeTransferFrom`; reverts `DealExists` / `ZeroAmount` / `UnknownBatch` (batch must exist in ProvenanceRegistry).
- `settle(bytes32 batchId)` — anyone may call; requires `isAttested`; if `scoreOf >= passThreshold` → `Released`, `safeTransfer` to supplier; else moves to `Disputed` (no auto-refund; buyer resolves). Reverts `NotFunded`, `NotAttested`, `AlreadySettled`. nonReentrant.
- `refund(bytes32 batchId)` — only when `Disputed`, callable by admin (dispute resolver) → returns funds to buyer. nonReentrant.
- Views: `getDeal(bytes32) returns (Deal)`.
- Events: `Funded(bytes32 indexed batchId, address indexed buyer, address supplier, address token, uint256 amount)`, `Released(bytes32 indexed batchId, address indexed supplier, uint256 amount)`, `Disputed(bytes32 indexed batchId, uint16 score)`, `Refunded(bytes32 indexed batchId, address indexed buyer, uint256 amount)`, `PassThresholdUpdated(uint16 oldT, uint16 newT)`.
- Errors: `DealExists(bytes32)`, `NotFunded(bytes32)`, `ZeroAmount()`, `AlreadySettled(bytes32)`, `NotAttested(bytes32)`, `UnknownBatch(bytes32)`.

### 4. `MockUSDC`
Simple ERC20 (6 decimals) with a public `mint(address,uint256)` for test faucet. Not for mainnet.

### Contracts deliverables
- `foundry.toml` (solc 0.8.24, optimizer on, remappings for OZ).
- Full Foundry test suite (`test/*.t.sol`) covering happy path, every revert, access control, reentrancy attempt on escrow, threshold boundary. Target real branch coverage.
- `script/Deploy.s.sol` — deploys all 4 contracts, wires roles (grants AGENT_ROLE to `AGENT_ADDRESS` env), writes deployed addresses to `deployments/base-sepolia.json`.
- `package.json` with scripts: `build` (`forge build`), `test` (`forge test -vvv`), `deploy:base-sepolia`. Export ABIs to `packages/shared/src/abis/` after build.

---

## Shared (package: shared, TypeScript, ESM)

The typed contract layer consumed by agent + web. No secrets here.

- `src/abis/*.json` — ABIs for the 4 contracts (copied/generated from contracts build).
- `src/addresses.ts` — reads deployed addresses from `contracts/deployments/base-sepolia.json` (or env override), exports typed `CONTRACTS[chainId]` map.
- `src/types.ts` — TS mirrors of on-chain structs + the agent verdict types below.
- `src/chains.ts` — Base Sepolia viem chain config, `chainId = 84532`.
- Verdict types (shared between agent output and on-chain/off-chain storage):
  ```ts
  export interface VerificationVerdict {
    batchId: `0x${string}`;
    score: number;              // 0..10000 bps
    passed: boolean;            // score >= threshold
    threshold: number;          // bps used
    findings: Finding[];        // structured anomaly list
    documentHashes: string[];   // sha256 of each inspected doc
    verdictURI?: string;        // IPFS URI once pinned
    createdAt: string;          // ISO
    model: string;              // agent model id
  }
  export interface Finding {
    code: string;               // e.g. "INVOICE_TOTAL_MISMATCH"
    severity: "info" | "low" | "medium" | "high" | "critical";
    message: string;
    evidence?: Record<string, unknown>;
  }
  ```
- Build with `tsup` (or tsc) to `dist/`, typed exports. `package.json` scripts: `build`, `typecheck`, `test` (vitest for the decoders/helpers).

---

## Agent (package: agent, TypeScript, Node service)

The AI verification agent. Exposes an HTTP API (Fastify or Express) and a Claude
tool-calling loop. Uses `@anthropic-ai/sdk`. **Model: `claude-opus-4-8` for reasoning;
`claude-haiku-4-5-20251001` acceptable for cheap sub-steps.** Never hardcode the API key —
read `ANTHROPIC_API_KEY` from env; fail fast at startup if missing.

### Responsibilities
1. Accept a verification job: `{ batchId, documents: [{name, mimeType, dataBase64 | url}] }`.
2. Parse documents (invoice, bill of lading) — use Claude vision for images/PDF pages; extract structured fields (totals, quantities, parties, dates, item lists).
3. Read on-chain provenance for `batchId` (viem, ProvenanceRegistry) — checkpoints, origin hash, supplier.
4. Cross-check parsed docs vs provenance + internal consistency; produce `Finding[]` and a `score` (bps).
5. Pin the full verdict JSON to IPFS (via infra helper / Pinata) → `verdictURI`.
6. Submit `attest(batchId, score, verdictHash, verdictURI)` on-chain using the agent signer (`AGENT_PRIVATE_KEY`, viem wallet). Idempotent: if already attested, return existing.
7. Optionally call `settle(batchId)` if `SETTLE_ON_ATTEST=true`.

### Claude tool-calling design
Define tools the model can call within the loop:
- `get_provenance(batchId)` → checkpoints + batch meta (from chain).
- `parse_document(index)` → structured fields for a supplied doc.
- `record_finding(code, severity, message, evidence)` → accumulates findings.
- `finalize_verdict(score, summary)` → ends the loop with a score.
The orchestrator enforces: max tool iterations, timeout, and validates the model's final
score. Deterministic scoring guard: recompute a rule-based score from findings severity and
reconcile with the model's score (take the stricter). This prevents nondeterministic passes.

### API (Fastify)
- `POST /verify` → runs full pipeline, returns `VerificationVerdict` + tx hash. Validate body with `zod`.
- `GET /health` → readiness (checks RPC + chain + env).
- `GET /jobs/:id` → status (jobs persisted in Supabase via infra client; in-memory fallback if DB not configured).
- Structured logging (pino). Rate limiting. Robust error envelope `{ success, data, error }`.

### Deliverables
- Full TS service, `zod` validation, unit tests (vitest) for scoring reconciliation, document-parse adapters (mockable Anthropic client), and the cross-check rules. Integration test against a locally-mocked chain (anvil) is a bonus.
- `.env.example` documenting every var. `package.json`: `dev`, `build`, `test`, `typecheck`, `start`.

---

## Web (package: web, Next.js App Router + TypeScript)

Production dApp. `wagmi` + `viem` + `RainbowKit`, Tailwind. Reads `@proofchain/shared`
for ABIs/addresses. Talks to the agent API for verification. No private keys in the browser.

### Screens
- **Supplier**: register batch, add checkpoints, upload shipment documents, request verification.
- **Buyer**: create/fund a deal (approve MockUSDC + `fund`), watch settlement status.
- **Verifier dashboard**: live table of batches with provenance trail, attestation score,
  findings (from verdictURI), and settlement state. Real-time updates via wagmi watch +
  contract event subscription.
- **Deal detail**: full timeline (registered → checkpoints → attested → settled/disputed),
  tx links to Base Sepolia explorer.

### Requirements
- Wallet connect (RainbowKit), Base Sepolia network guard with switch prompt.
- All contract writes: optimistic UI + error toasts + tx confirmation states.
- Input validation on all forms (zod + react-hook-form). Loading/empty/error states everywhere.
- Env: `NEXT_PUBLIC_WALLETCONNECT_ID`, `NEXT_PUBLIC_AGENT_API_URL`, `NEXT_PUBLIC_CHAIN_ID`.
- `package.json`: `dev`, `build`, `start`, `lint`, `typecheck`. Type-safe, no `any` leaks.

---

## Infra (package: infra, TypeScript)

- **Supabase**: SQL schema `schema.sql` — tables: `jobs` (verification jobs + status),
  `verdicts` (verdict cache), `deals` (mirror of on-chain deals for fast queries).
  RLS notes documented. A typed Supabase client wrapper.
- **IPFS**: `pinJson(obj)` / `pinFile(buf)` via Pinata (`PINATA_JWT` env) with a
  local no-op fallback (returns a `ipfs://mock/<sha256>` URI) when unconfigured, so the
  system runs without external accounts.
- **Deploy docs**: `README.md` covering contract deploy, agent hosting (Railway/Fly),
  web deploy (Vercel), and env wiring end-to-end.
- `.env.example` at repo root aggregating ALL env vars across packages.

---

## Cross-cutting production requirements (ALL packages)

- **No hardcoded secrets.** Everything via env; validate presence at startup; `.env.example` documents each.
- **Input validation** at every boundary (zod on TS, custom errors on Solidity).
- **Error handling**: never swallow; structured error envelopes; user-friendly UI messages.
- **Tests**: meaningful coverage (target 80%+ where practical). Contracts: full revert + access-control coverage.
- **Immutable/functional TS style**; small focused files (<400 lines typical).
- **Typecheck + lint clean.** TS strict mode on.
- **README per package** describing purpose, setup, scripts, env.

## Shared env vars (root .env.example)

```
# chain
BASE_SEPOLIA_RPC_URL=
NEXT_PUBLIC_CHAIN_ID=84532
# contracts / deploy
DEPLOYER_PRIVATE_KEY=
AGENT_ADDRESS=
# agent service
ANTHROPIC_API_KEY=
AGENT_PRIVATE_KEY=
SETTLE_ON_ATTEST=false
# storage
PINATA_JWT=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
# web
NEXT_PUBLIC_WALLETCONNECT_ID=
NEXT_PUBLIC_AGENT_API_URL=http://localhost:8080
```
