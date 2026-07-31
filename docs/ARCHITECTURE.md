# ProofChain — Architecture

> AI-verified supply-chain provenance with autonomous on-chain settlement.
> Target chain: **Base Sepolia** (`chainId 84532`). Stablecoin: **MockUSDC** (ERC20, 6 decimals),
> swappable for real USDC on mainnet via the `SettlementEscrow` constructor.

This document describes what is actually in the code. Every contract, function, type, and file
name below is real and can be traced to the source. The interface contract is
[`docs/SPEC.md`](./SPEC.md); this document explains how the four packages implement it.

---

## 1. System Overview

ProofChain closes the loop between physical-shipment paperwork and on-chain money. A supplier
registers a batch and its checkpoints on-chain (the ground truth). An autonomous AI agent inspects
the shipment documents, cross-checks them against that on-chain trail, scores fraud/anomaly risk,
writes a **signed, immutable attestation** on-chain, and — for clean shipments — releases escrowed
USDC to the supplier. Fraudulent shipments are held in a `Disputed` state for human resolution and
are never auto-paid.

### Monorepo layout (pnpm workspaces)

| Package | Name | Stack | Responsibility |
| --- | --- | --- | --- |
| `packages/contracts` | `@proofchain/contracts` | Foundry / Solidity `0.8.24` | The four on-chain contracts, tests, deploy script |
| `packages/shared` | `@proofchain/shared` | TypeScript (ESM, `tsup`) | Typed contract layer: ABIs, addresses, struct mirrors, verdict types, event decoders |
| `packages/agent` | `@proofchain/agent` | TypeScript + Fastify | The Claude verification service (tool-calling loop, scoring, on-chain writes) |
| `packages/web` | `@proofchain/web` | Next.js App Router + wagmi/viem/RainbowKit | dApp: supplier / buyer / verifier screens |
| `packages/infra` | `@proofchain/infra` | TypeScript | Supabase read models, IPFS pinning, deploy docs |

Dependency direction (never circular):
`contracts` → produces ABIs consumed by → `shared` → consumed by `agent` and `web`. `infra` is
standalone.

### Component diagram & data flow

```
                              ┌──────────────────────────────────────────────┐
                              │  @proofchain/web  (Next.js dApp)               │
                              │  supplier · buyer · verifier · deal-detail     │
                              └───┬───────────────┬──────────────────┬────────┘
             register/checkpoint  │  approve+fund │  request verify  │  watch events / read verdict
                                  │               │                  │
                                  ▼               ▼                  ▼
   ┌───────────────────┐   ┌───────────────┐   ┌────────────────────────────────────────────┐
   │ ProvenanceRegistry│   │SettlementEscrow│  │  @proofchain/agent  (Fastify HTTP service)  │
   │  Batch + Checkpts │   │  Deal escrow   │   │  POST /verify · GET /health · GET /jobs/:id │
   │  (ground truth)   │   │  (holds USDC)  │   └───────────────┬─────────────────────────────┘
   └─────────▲─────────┘   └───────▲────────┘                   │
             │  batchExists /       │  reads scoreOf,           │ (1) read provenance (viem)
             │  batchSupplier /     │  isAttested               │ (2) parse docs (Claude vision)
             │  getCheckpoints      │                           │ (3) tool-calling loop (Claude)
             │                      │                           │ (4) deterministic cross-checks
   ┌─────────┴──────────┐          │                           │ (5) score reconciliation
   │ AttestationRegistry│◄─────────┘                           │ (6) pin verdict → IPFS
   │  immutable verdict │   attest(batchId,score,...)          │ (7) attest() on-chain (agent signer)
   │  score (bps)       │◄─────────────────────────────────────┘ (8) optional settle()
   └────────────────────┘
                                  │
          ┌───────────────────────┴────────────────────────┐
          │  @proofchain/infra                              │
          │  Supabase (jobs · verdicts · deals mirror) ·    │
          │  IPFS pinning (Pinata + local mock fallback)    │
          └─────────────────────────────────────────────────┘

  supplier ──▶ provenance ──▶ agent ──▶ attestation ──▶ escrow ──▶ settlement (release | dispute)
```

---

## 2. On-Chain Layer (`packages/contracts/src`)

Four contracts, all Solidity `0.8.24`, built on OpenZeppelin `AccessControl`, `SafeERC20`,
`ReentrancyGuard`, and `Pausable`. All state-changing functions emit events and validate inputs
with custom errors. Two interfaces (`interfaces/IProvenanceRegistry.sol`,
`interfaces/IAttestationRegistry.sol`) decouple the escrow/attestation contracts from concrete
implementations.

### 2.1 `ProvenanceRegistry.sol` — the ground truth

Append-only record of shipment batches and their checkpoints.

- **Roles:** `DEFAULT_ADMIN_ROLE`, `REGISTRAR_ROLE` (`keccak256("REGISTRAR_ROLE")`). The constructor
  grants both to the `admin`. Suppliers/carriers holding `REGISTRAR_ROLE` register batches and
  append checkpoints.
- **Structs:** `Batch { bytes32 batchId; address supplier; bytes32 originHash; string metadataURI;
  uint64 createdAt; bool exists; }` and `Checkpoint { bytes32 batchId; string location; uint64
  timestamp; bytes32 dataHash; }`.
- **`registerBatch(bytes32 batchId, bytes32 originHash, string metadataURI)`** — `onlyRole(REGISTRAR_ROLE)`;
  reverts `BatchExists` if already registered, `EmptyMetadata()` if the URI is empty; sets
  `supplier = msg.sender` and `createdAt = block.timestamp`.
- **`addCheckpoint(bytes32 batchId, string location, uint64 timestamp, bytes32 dataHash)`** —
  `onlyRole(REGISTRAR_ROLE)`; reverts `UnknownBatch` if the batch is not registered; append-only push.
- **Views:** `getBatch`, `getCheckpoints`, `checkpointCount`, plus two helpers the escrow/attestation
  contracts rely on: **`batchExists(bytes32) → bool`** and **`batchSupplier(bytes32) → address`**.
- **Events:** `BatchRegistered`, `CheckpointAdded`. **Errors:** `BatchExists`, `UnknownBatch`,
  `EmptyMetadata`.

### 2.2 `AttestationRegistry.sol` — signed AI verdicts

Stores one **immutable** attestation per batch. Only the authorized agent may write.

- **Roles:** `DEFAULT_ADMIN_ROLE`, `AGENT_ROLE` (`keccak256("AGENT_ROLE")`, the verification agent's
  keypair). `MAX_SCORE = 10_000`.
- Holds an **immutable** `IProvenanceRegistry provenance` reference set in the constructor (reverts
  `ZeroAddress()` on a zero admin or registry).
- **Struct:** `Attestation { bytes32 batchId; uint16 score; bytes32 verdictHash; string verdictURI;
  uint64 attestedAt; address agent; bool exists; }`. `score` is basis points (0–10000; e.g. 9600 = 0.96).
- **`attest(bytes32 batchId, uint16 score, bytes32 verdictHash, string verdictURI)`** —
  `onlyRole(AGENT_ROLE)`; reverts `UnknownBatch` if `!provenance.batchExists(batchId)`, `InvalidScore`
  if `score > MAX_SCORE`, and `AlreadyAttested` if one already exists. Attestations are permanent —
  re-verification is out of scope by design.
- **Views:** `getAttestation`, `isAttested`, `scoreOf` (reverts `NotAttested` when absent).
- **Events:** `Attested`. **Errors:** `InvalidScore`, `AlreadyAttested`, `NotAttested`,
  `UnknownBatch`, `ZeroAddress`.

### 2.3 `SettlementEscrow.sol` — provenance-gated payout

Holds buyer funds; releases to the supplier only when a passing attestation exists. Inherits
`AccessControl, ReentrancyGuard, Pausable` and uses `SafeERC20 for IERC20`.

- Holds **immutable** references to both `IAttestationRegistry attestations` and
  `IProvenanceRegistry provenance`.
- **Threshold:** `passThreshold` (uint16 bps), initialized to `DEFAULT_PASS_THRESHOLD = 7000`,
  adjustable via **`setPassThreshold(uint16)`** (`onlyRole(DEFAULT_ADMIN_ROLE)`; reverts
  `InvalidThreshold` if 0 or > `MAX_BPS`). Deals scoring `>= passThreshold` are released.
- **`enum DealState { None, Funded, Released, Refunded, Disputed }`** and
  `Deal { bytes32 batchId; address buyer; address supplier; address token; uint256 amount; DealState state; }`.
- **`fund(bytes32 batchId, address supplier, address token, uint256 amount)`** — `nonReentrant
  whenNotPaused`. Validates `ZeroAmount`, `ZeroAddress`, `DealExists` (state must be `None`),
  `UnknownBatch` (`provenance.batchExists`), and critically **`SupplierMismatch`**: the funded
  `supplier` must equal `provenance.batchSupplier(batchId)`. Pulls funds via `safeTransferFrom`.
- **`settle(bytes32 batchId)`** — `nonReentrant whenNotPaused`, callable by **anyone**. Reverts
  `NotFunded` (state `None`), `AlreadySettled` (state not `Funded`), `NotAttested`. If
  `attestations.scoreOf(batchId) >= passThreshold` → `Released` + `safeTransfer` to supplier; else →
  `Disputed` (no auto-refund).
- **`refund(bytes32 batchId)`** — `nonReentrant`, `onlyRole(DEFAULT_ADMIN_ROLE)` (dispute resolver).
  Requires state `Disputed` (else `NotDisputed`); returns funds to the buyer, state → `Refunded`.
- **`pause()` / `unpause()`** — admin-gated circuit breaker over `fund`/`settle`.
- **Events:** `Funded`, `Released`, `Disputed`, `Refunded`, `PassThresholdUpdated`.

#### Deal state machine

```
                    fund()                    settle() [score >= passThreshold]
   None ───────────────────────▶ Funded ───────────────────────────────────────▶ Released
    ▲  DealExists if not None      │                                             (funds → supplier)
    │                              │ settle() [score < passThreshold]
    │                              ▼
    │                          Disputed ───────────────────────────────────────▶ Refunded
    │                                       refund()  (admin only)             (funds → buyer)
```

`Released` and `Refunded` are terminal. `settle()` on a non-`Funded` deal reverts `AlreadySettled`,
so a deal transitions out of `Funded` exactly once.

### 2.4 `MockUSDC.sol`

ERC20 named "Mock USDC" / "mUSDC" with `decimals() = 6` and a permissionless `mint(address,uint256)`
faucet (reverts `ZeroAddress`/`ZeroAmount`). Explicitly not for mainnet.

### 2.5 Security properties

- **Access control.** Registration is gated by `REGISTRAR_ROLE`; attestation by `AGENT_ROLE`;
  threshold changes, pausing, and refunds by `DEFAULT_ADMIN_ROLE`. Roles are wired at deploy time by
  `script/Deploy.s.sol`, which grants `AGENT_ROLE` to the `AGENT_ADDRESS` env value.
- **Reentrancy.** `fund`, `settle`, and `refund` are all `nonReentrant`; token movement uses
  `SafeERC20` (`safeTransfer` / `safeTransferFrom`). State is written before external transfers
  (checks-effects-interactions): `settle` sets `deal.state = Released` before `safeTransfer`. A
  malicious `ReentrantToken` test exercises this path.
- **Fee-on-transfer / rebasing safety.** `fund` records the **actually received** balance
  (`balanceOf(this)` after minus before) rather than trusting `amount`, so the escrow can never end
  up holding less than `deal.amount` — which would otherwise brick `settle()`/`refund()`. A zero net
  receipt reverts `ZeroAmount`.
- **Provenance-to-payment binding.** `fund`'s `SupplierMismatch` check guarantees escrow can only
  ever pay the exact address that registered the batch on-chain, so a payout cannot be redirected to
  an impostor supplier.
- **Threshold semantics.** Pass/fail is a single, on-chain, comparison: `scoreOf >= passThreshold`.
  The default 7000 bps mirrors the agent's `DEFAULT_PASS_THRESHOLD_BPS`. A failing score never moves
  money — it only flags `Disputed`.
- **Immutability.** One attestation per batch (`AlreadyAttested`) means a verdict, once written,
  cannot be overwritten to flip a settlement.

Tests live in `packages/contracts/test/*.t.sol` (`ProvenanceRegistry.t.sol`,
`AttestationRegistry.t.sol`, `SettlementEscrow.t.sol`, `MockUSDC.t.sol`, `EndToEnd.t.sol`) covering
the happy path, every revert, access control, a reentrancy attempt, and the threshold boundary.

---

## 3. The AI Verification Agent (`packages/agent/src`)

A Fastify service that runs a Claude tool-calling loop and writes results on-chain. Model defaults
(from `config/constants.ts`): reasoning `claude-opus-4-8`, cheap document parsing
`claude-haiku-4-5`. Secrets are never hardcoded — `config/env.ts` validates every variable with zod
and fails fast (`CONFIG_ERROR`) at startup; `ANTHROPIC_API_KEY`, `AGENT_PRIVATE_KEY` (32-byte hex),
and `BASE_SEPOLIA_RPC_URL` are required.

### 3.1 The tool-calling loop (`orchestrator/orchestrator.ts`)

`runVerificationLoop(deps, ctx)` drives Claude through four tools defined in `anthropic/tools.ts`,
each with a zod schema that validates the model's tool input at the boundary:

| Tool (`TOOL_NAMES`) | Input schema | Effect |
| --- | --- | --- |
| `get_provenance` | `{ batchId: 0x + 64 hex }` | Returns the on-chain provenance summary (supplier, originHash, checkpoints) |
| `parse_document` | `{ index: int >= 0 }` | Returns structured fields for the supplied document at that index |
| `record_finding` | `findingSchema` (`code` UPPER_SNAKE, `severity`, `message`, `evidence?`) | Accumulates a `Finding` |
| `finalize_verdict` | `{ score: int 0..10000, summary: string }` | Ends the loop with the model's proposed score |

The orchestrator owns the control flow and enforces hard safety rails:

- **Max iterations** — `deps.maxIterations` (`MAX_TOOL_ITERATIONS`, default 12).
- **Wall-clock timeout** — checked each iteration against `deps.timeoutMs` (`VERIFY_TIMEOUT_MS`,
  default 120000 ms); exceeding it throws `ORCHESTRATION_TIMEOUT`. An injectable `now()` clock keeps
  timeout tests deterministic.
- **Fail-closed exhaustion.** If the loop ends without `finalize_verdict` — iterations exhausted, or
  the model produced only text — it returns `modelScore: 0` plus a synthetic high-severity
  `INCOMPLETE_VERIFICATION` finding. **An unfinished analysis can never wave a shipment through.**

Tool dispatch (`handleToolUse`) is a pure state transition: it returns the `tool_result` to feed
back to the model plus the next `LoopState`, never mutating its input. Validation failures are
returned to the model as `is_error` tool results so it can self-correct — they never crash the loop.

### 3.2 Deterministic scoring reconciliation (`domain/scoring.ts`) — the trust anchor

The model proposes a score, but **it is never trusted blindly**. This is the security core of the
agent.

- **`computeRuleScore(findings)`** — a pure, total function. Start at `MAX_SCORE_BPS` (10000) and
  subtract a fixed per-severity penalty from `SEVERITY_PENALTY_BPS`: `info 0`, `low 300`, `medium
  1000`, `high 3000`, `critical 10000`. A single `critical` finding forces a hard 0. The result is
  clamped to `[0, 10000]`.
- **`assertValidModelScore(score)`** — the model's score must be a finite integer in `[0, 10000]`,
  else `VALIDATION_ERROR` (fail fast, never silently coerce).
- **`reconcileScore(modelScore, findings, threshold)`** — computes `finalScore = min(modelScore,
  ruleScore)` (**the stricter/lower value wins**), records which side won (`source`), and sets
  `passed = finalScore >= threshold`.

**Why this matters:** LLM output is nondeterministic. If a fraudulent shipment triggers a
deterministic `critical` cross-check (e.g. `ORIGIN_HASH_MISMATCH` or `UNKNOWN_BATCH`), the rule
score is 0 and no model opinion can lift it — reconciliation caps the final score at the rule score.
Conversely a model that hallucinates a high score cannot exceed what the findings justify. This
makes a **passing verdict reproducible** and grounded in verifiable facts.

### 3.3 Deterministic cross-checks (`domain/crosscheck.ts`)

`runCrossChecks({ provenance, documents })` runs nine pure rules **independently of the model** and
flat-maps their findings. Each rule is total and side-effect free:

`ruleNoDocuments` (high), `ruleProvenancePresence` (`UNKNOWN_BATCH` critical / `NO_CHECKPOINTS`
medium), `ruleInvoiceTotals` (`INVOICE_TOTAL_MISMATCH` high, line items must sum to the stated
total within 0.5% or 1 cent), `ruleLineItemMath` (`LINE_ITEM_AMOUNT_MISMATCH` medium,
`amount == quantity * unitPrice`), `ruleOriginHash` (`ORIGIN_HASH_MISMATCH` critical, declared vs
on-chain origin hash), `ruleQuantityConsistency` (`QUANTITY_MISMATCH` high), `ruleSupplierConsistency`
(`SUPPLIER_MISMATCH` high), `ruleDateConsistency` (`DATE_INCONSISTENCY` low, doc dated before batch
registration), and `ruleCheckpointOrder` (`CHECKPOINT_ORDER` low, timestamps must be non-decreasing).

Model findings and rule findings are combined by **`mergeFindings`** (`domain/findings.ts`), which
keeps the strictest instance per unique `code` (by `SEVERITY_RANK`) and stable-sorts by descending
severity then code — producing a deterministic, de-duplicated finding set.

### 3.4 The pipeline (`verifier.ts`) and the on-chain write path

`createVerifier(deps).verify(req)` ties everything together with fully injected dependencies (chain
client, document parser, pinner, orchestrator), so the whole pipeline is unit-testable with no
network:

1. **Read provenance** for `batchId` via `chain.getProvenance`.
2. **Idempotency guard.** A *single* `chain.getAttestation(batchId)` call — deliberately not
   `isAttested` then `getAttestation`, to avoid a TOCTOU window. If an attestation exists, it returns
   immediately with a verdict reconstructed from chain (`alreadyAttested: true`), never
   double-attesting. This satisfies SPEC "if already attested, return existing".
3. **Parse documents** sequentially (`document-parser.ts`, Claude vision → zod-validated JSON;
   enforces `MAX_DOCUMENTS` in the domain layer too, not just the HTTP schema).
4. **Run the tool-calling loop** (§3.1).
5. **Cross-checks + merge** (§3.3).
6. **Reconcile** model vs rule score (§3.2), logging both scores and the winning source.
7. **Build, pin, hash the verdict.** The canonical `coreVerdict` is pinned via `pinner.pinJson`
   (→ `verdictURI`) and hashed with `keccakOfString(JSON.stringify(coreVerdict))` (→ `verdictHash`).
8. **Attest on-chain** via `chain.attest({ batchId, score, verdictHash, verdictURI })`.
9. **Optional settle.** If `SETTLE_ON_ATTEST=true`, call `chain.settle(batchId)` **fail-soft** — a
   settle error is logged but never invalidates the attestation that already landed on-chain.

The viem chain client (`chain/viem-client.ts`) is the only module importing viem. It resolves
addresses from `@proofchain/shared` `CONTRACTS[chainId]` (failing fast with `CONFIG_ERROR` if any is
missing), signs with `privateKeyToAccount(AGENT_PRIVATE_KEY)`, and `waitForTransactionReceipt`s every
write, throwing `chainError` on a reverted receipt.

### 3.5 HTTP API (`http/`)

Fastify server (`http/server.ts`) with `@fastify/rate-limit`, a 25 MB body limit, and a uniform
error handler that wraps every response in the `{ success, data, error }` envelope (`ok`/`fail`) and
never leaks stack traces (429s become `RATE_LIMITED`, unknown routes `NOT_FOUND`).

- **`POST /verify`** — zod-validates the body, creates a job (`jobStore.create`), runs the pipeline,
  persists success/failure, and returns `{ jobId, verdict, txHash, ... }`.
- **`GET /health`** — readiness probe that does a cheap `chain.isAttested(0x0…)` read; returns 200
  `ok` or 503 `degraded` with the agent address and per-check status.
- **`GET /jobs/:id`** — job status. Jobs are persisted behind the `JobStore` interface
  (`jobs/store.ts`); an in-memory store ships by default with a Supabase-backed implementation
  droppable behind the same interface.

Logging is structured via pino (`logger.ts`).

---

## 4. Off-Chain Layer

### 4.1 Shared typed contract layer (`packages/shared/src`)

The single source of truth consumed by both agent and web — no secrets.

- **`abis/`** — the four contract ABIs (JSON) plus `abis/index.ts` exporting `attestationRegistryAbi`,
  `provenanceRegistryAbi`, `settlementEscrowAbi`, `mockUsdcAbi`, `CONTRACT_NAMES`, and `ABIS`.
- **`addresses.ts`** — `resolveContractAddresses` layers sources (env `*_ADDRESS` /
  `NEXT_PUBLIC_*_ADDRESS` overrides win over the on-disk `deployments/base-sepolia.json` manifest),
  exposing the typed `CONTRACTS[chainId]` map plus `getContractAddress` (throws
  `MissingAddressError`) and `tryGetContractAddress`. `readDeploymentManifest` degrades to `null` in
  the browser so web consumers rely on `NEXT_PUBLIC_*` env overrides.
- **`chains.ts`** — Base Sepolia viem chain config, `CHAIN_ID = 84532`.
- **`types.ts`** — on-chain struct mirrors (`Batch`, `Checkpoint`, `Attestation`, `Deal`,
  `DealState` enum + `DEAL_STATE_LABELS`) and the verdict types (§6), with zod schemas
  (`VerificationVerdictSchema` even cross-checks that `passed === (score >= threshold)`).
- **`decoders.ts`** — `decodeProofchainLog` / `parseContractLogs` / `tryDecodeProofchainLog` decode
  EVM logs against the ProofChain ABIs, validating raw log shape with zod first.

### 4.2 Infra (`packages/infra/src`, `schema.sql`)

- **Supabase (`supabase.ts`, `schema.sql`).** Three tables mirror the system for fast dashboard
  queries: `jobs` (verification jobs + status), `verdicts` (one row per batch, mirroring the
  immutable on-chain attestation), and `deals` (read-model mirror of `SettlementEscrow`). All hex
  ids/addresses/hashes are stored as lowercase hex `text` with format `CHECK`s, `score`/`threshold`
  carry `0..10000` range checks, `amount` is `numeric(78,0)` (fits uint256), and an `updated_at`
  trigger keeps read models fresh. **RLS is deny-by-default**: anon/authenticated get read-only
  policies (dashboards are public, no PII); all writes go through the service role (which bypasses
  RLS) from trusted server code. `createSupabaseStore` **degrades gracefully** — when unconfigured it
  returns a no-op store (reads → empty, writes → `NOT_CONFIGURED` envelope) and never throws; the
  `@supabase/supabase-js` dependency is imported lazily only when configured. Every row crossing the
  boundary is zod-validated (`types.ts`).
- **IPFS (`ipfs.ts`).** `createIpfsClient` picks a backend from config: **Pinata** when `PINATA_JWT`
  is set (real `ipfs://<cid>`), otherwise a **deterministic local mock** returning
  `ipfs://mock/<sha256>` of the canonical JSON — so the whole system runs end-to-end with no external
  account. All operations return a `Result<PinResult>`; HTTP failures become structured envelopes,
  never throws, and requests are bounded by a 30 s timeout. The agent has its own mirror of this
  fallback in `verdict/pinner.ts` (`createPinner` → Pinata or local), which additionally falls back
  to the local mock if a Pinata call fails, so a storage outage never blocks a valid attestation.

### 4.3 Web (`packages/web/src`) — skim

Next.js App Router dApp using wagmi + viem + RainbowKit + TanStack Query, reading ABIs/addresses from
`@proofchain/shared`. Screens: `app/supplier` (register batch, add checkpoints, request
verification), `app/buyer` (approve MockUSDC + `fund`), `app/verifier` (live batch table), and
`app/deals/[batchId]` (full timeline). Real-time updates come from event indexing — e.g.
`hooks/useBatches.ts` discovers batches from `BatchRegistered` logs and keeps them live via
`useWatchContractEvent` (the registry has no on-chain enumeration). `lib/agent-api.ts` is a typed
client for the agent API that validates every response against zod schemas and maps failures to
typed `AppError`s (`AGENT_TIMEOUT`, `AGENT_UNREACHABLE`, `AGENT_SCHEMA`, …). No private keys ever
touch the browser.

---

## 5. Trust Model & Threat Considerations

**Who can do what:**

- **Supplier / carrier** (`REGISTRAR_ROLE`) — registers batches and appends checkpoints. Becomes the
  immutable `supplier` of record for a batch.
- **Buyer** (any address) — funds a deal, but only for the address that actually registered the
  batch (`SupplierMismatch` guard). Anyone may trigger `settle`.
- **Agent** (`AGENT_ROLE`, the `AGENT_PRIVATE_KEY` signer) — the single trusted off-chain actor. It
  and only it may write attestations.
- **Admin / dispute resolver** (`DEFAULT_ADMIN_ROLE`) — sets the pass threshold, pauses the escrow,
  and refunds disputed deals.

**What the escrow guarantees:** funds move on exactly one deterministic, on-chain condition —
`scoreOf(batchId) >= passThreshold`. There is no path where a failing score releases money;
sub-threshold scores only flag `Disputed`, from which just the admin can `refund` to the buyer.
Terminal states are reached exactly once, protected by `nonReentrant` and checks-effects-interactions.

**What is trusted:** the agent signer. It is the sole holder of `AGENT_ROLE`, so the integrity of the
whole system reduces to (a) the security of `AGENT_PRIVATE_KEY` and (b) the honesty of the scoring
logic it runs. ProofChain hardens (b) so the agent cannot be *tricked* into a bad pass even if the
LLM misbehaves:

**How a fraudulent shipment is prevented from being paid:**

1. **Deterministic cross-checks** run independently of the model. Fraud that breaks provenance
   (`UNKNOWN_BATCH`, `ORIGIN_HASH_MISMATCH`) yields a `critical` finding.
2. **`computeRuleScore` forces a hard 0** on any `critical` finding, regardless of what the LLM says.
3. **`reconcileScore` takes the stricter score** (`min(model, rule)`), so a hallucinated or
   manipulated high model score cannot override the rule-based floor.
4. **The escrow re-derives pass/fail on-chain** from the persisted `score`, so even a compromised
   read path off-chain cannot change the settlement outcome.
5. **Fail-closed orchestration** means a timed-out or incomplete verification scores 0, not "pass".
6. **Immutability** (`AlreadyAttested`) prevents a second attestation from flipping a settled verdict.

The residual trust surface is the agent key itself and the correctness of the deterministic rules —
both auditable and testable, unlike raw model output.

---

## 6. Data Model

### 6.1 Off-chain verdict types (`shared/src/types.ts`, mirrored in `agent/src/shared.ts`)

```ts
interface VerificationVerdict {
  batchId: `0x${string}`;
  score: number;              // 0..10000 bps (final, reconciled)
  passed: boolean;            // score >= threshold
  threshold: number;          // bps used
  findings: Finding[];        // deduped, severity-sorted anomaly list
  documentHashes: string[];   // sha256 of each inspected doc
  verdictURI?: string;        // ipfs:// URI once pinned
  createdAt: string;          // ISO 8601
  model: string;              // agent model id
}

interface Finding {
  code: string;               // e.g. "INVOICE_TOTAL_MISMATCH" (UPPER_SNAKE_CASE)
  severity: "info" | "low" | "medium" | "high" | "critical";
  message: string;
  evidence?: Record<string, unknown>;
}
```

The full `VerificationVerdict` is what gets pinned to IPFS; its keccak256 becomes the on-chain
`verdictHash`, binding the immutable attestation to the exact document that produced it.

### 6.2 On-chain structs (Solidity ↔ TypeScript mirrors)

| Solidity struct | TS mirror (`shared/src/types.ts`) | Notes |
| --- | --- | --- |
| `ProvenanceRegistry.Batch` | `Batch` | `createdAt` is `bigint` in TS (`uint64` on chain) |
| `ProvenanceRegistry.Checkpoint` | `Checkpoint` | |
| `AttestationRegistry.Attestation` | `Attestation` | `score` kept as `number` (uint16 bps fits JS safely) |
| `SettlementEscrow.Deal` | `Deal` | `amount` is `bigint`; `state` is `DealState` |
| `SettlementEscrow.DealState` | `enum DealState { None=0, Funded=1, Released=2, Refunded=3, Disputed=4 }` | numeric values match Solidity ordering exactly |

The agent additionally uses internal domain types (`agent/src/domain/types.ts`) — `ProvenanceData`,
`ParsedDocument`/`ParsedDocumentFields`, `LineItem`, `OnchainAttestation`, `ScoreReconciliation`,
`OrchestratorResult` — deliberately distinct from the shared verdict envelope so the pipeline's
intermediate state stays decoupled from the public contract layer.

---

## Appendix: Key Configuration

| Constant | Value | Source |
| --- | --- | --- |
| Chain id | `84532` (Base Sepolia) | `shared/src/chains.ts`, `config/env.ts` default |
| Pass threshold | `7000` bps | `DEFAULT_PASS_THRESHOLD` (escrow) / `DEFAULT_PASS_THRESHOLD_BPS` (agent) |
| Severity penalties (bps) | info 0 · low 300 · medium 1000 · high 3000 · critical 10000 | `config/constants.ts` |
| Max tool iterations | 12 | `DEFAULT_MAX_TOOL_ITERATIONS` |
| Verify timeout | 120000 ms | `DEFAULT_VERIFY_TIMEOUT_MS` |
| Max documents | 16 | `DEFAULT_MAX_DOCUMENTS` |
| Reasoning / parse model | `claude-opus-4-8` / `claude-haiku-4-5` | `config/constants.ts` |

> Note: the checked-in `packages/contracts/deployments/base-sepolia.json` currently holds a local
> anvil deployment (`chainId 31337`); production addresses are supplied per-environment via the
> `*_ADDRESS` / `NEXT_PUBLIC_*_ADDRESS` env overrides resolved in `shared/src/addresses.ts`.
