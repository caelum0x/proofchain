# ProofChain — Roadmap & Target Architecture

Phased plan from the current verified state to a submitted, live, extensible product.
Legend: ✅ done · 🔜 next · ⛔ blocked on external input · 💤 post-hackathon.

---

## Phase status overview

| Phase | Title | State | Gate |
|-------|-------|-------|------|
| 0 | Foundation & spec | ✅ done | monorepo + `SPEC.md` |
| 1 | Production build (5 packages) | ✅ done | 314 tests green |
| 2 | Local verification + docs + demo data | ✅ done | `local-e2e.sh` passes; full docs |
| 3 | **Live on Base Sepolia** | ⛔ needs funded deployer key | real tx links |
| 4 | Hardening & product depth | 🔜 partially parallelizable now | indexer, queue, CI, observability |
| 5 | Submission packaging | 🔜 | pitch deck, video, GitHub push |
| 6 | Post-hackathon productization | 💤 | mainnet, identity, multi-attestation |

---

## Phase 3 — Live on Base Sepolia ⛔

**Goal:** the exact `local-e2e` flow, but on Base Sepolia with public explorer links.

**Blocked on:** a faucet-funded `DEPLOYER_PRIVATE_KEY` + a little test ETH sent to the
agent signer `0xeBcc3857C046872F25ff39c08A6FB02E52944793`.

**Tasks**
1. Fill `.env` (`DEPLOYER_PRIVATE_KEY`, keep `AGENT_*`, real `BASE_SEPOLIA_RPC_URL` if rate-limited).
2. `forge script script/Deploy.s.sol:Deploy --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify`
   → produces the real `deployments/base-sepolia.json` (chainId 84532) and verifies on Basescan.
3. Regenerate/confirm ABIs are in sync (`scripts/export-abis.mjs`).
4. Run the live end-to-end: register → checkpoint → agent `/verify` (real Claude) → attest → fund → settle.
5. Deploy the agent (Railway/Fly) and web (Vercel); wire `NEXT_PUBLIC_AGENT_API_URL`.

**New files**
```
scripts/deploy-base-sepolia.sh        # NEW — one-shot live deploy + address capture
scripts/live-e2e.sh                   # NEW — drives the flow against Base Sepolia
packages/contracts/deployments/
  base-sepolia.json                   # NEW (real, chainId 84532) — currently gitignored local anvil
```

**Acceptance:** clean shipment released + fraud shipment disputed, both with Basescan tx links.

---

## Phase 4 — Hardening & product depth 🔜

Split into independent workstreams (each a candidate subagent / workflow stage).

### 4a. On-chain indexer / event API
Move the web dashboard off ad-hoc `getContractEvents` scans onto a real index.
```
packages/indexer/                     # NEW package (@proofchain/indexer)
  src/index.ts                        #   Ponder or viem log-poller
  ponder.config.ts                    #   or a lightweight custom indexer
  src/handlers/{provenance,attestation,escrow}.ts
  schema.ts                           #   batches, checkpoints, attestations, deals
  README.md
```
*Alternative:* a Subgraph under `packages/subgraph/` (`subgraph.yaml`, `schema.graphql`, `src/mappings.ts`).

### 4b. Agent: durable jobs, queue, webhooks
Persist verification jobs and process async.
```
packages/agent/src/jobs/
  queue.ts                            # NEW — job queue (Supabase-backed or BullMQ)
  worker.ts                           # NEW — background processor
packages/agent/src/http/routes/
  webhooks.ts                         # NEW — notify web/buyer on verdict/settlement
packages/agent/src/chain/
  nonce-manager.ts                    # NEW — safe concurrent attest/settle tx sequencing
packages/agent/src/observability/
  metrics.ts                          # NEW — prom metrics (verify latency, pass rate)
  tracing.ts                          # NEW — OpenTelemetry spans
```

### 4c. Web: dispute & arbitration UX
```
packages/web/src/app/disputes/page.tsx        # NEW — dispute queue for admin/arbiter
packages/web/src/components/DisputeResolver.tsx# NEW — refund / override actions
packages/web/src/hooks/useDisputes.ts          # NEW
packages/web/src/app/dashboard/page.tsx        # NEW — metrics (pass rate, volume settled)
```

### 4d. Contracts: arbitration role + partial refund
```
packages/contracts/src/SettlementEscrow.sol    # extend: ARBITER_ROLE, partialRefund, deadline auto-refund
packages/contracts/test/Arbitration.t.sol      # NEW
packages/contracts/src/interfaces/ISettlementEscrow.sol  # NEW (formalize consumer interface)
```

### 4e. CI/CD + quality gates
```
.github/workflows/ci.yml              # NEW — forge test + pnpm -r test/typecheck/lint on PR
.github/workflows/deploy.yml          # NEW — deploy agent+web on main
.github/workflows/slither.yml         # NEW — Slither static analysis on contracts
.solhint.json                         # NEW — Solidity linting
.github/dependabot.yml                # NEW
```

### 4f. Security pass (pre-submission)
```
docs/SECURITY.md                      # NEW — threat model, roles, audit notes
packages/contracts/audit/             # NEW — slither/mythril reports
```

---

## Phase 5 — Submission packaging 🔜

**Tasks**
1. **GitHub push** ⛔ needs the repo remote (your account). Prep clean history + tags.
2. Pitch deck + 2–3 min demo video (record `DEMO.md` run).
3. Final rule-compliance sweep (`SUBMISSION.md` checklist).
4. Cut a `v1.0.0` tag.

**New files**
```
docs/PITCH.md                         # NEW — slide outline / talking points
docs/media/                           # NEW — screenshots, diagram exports, demo.mp4 link
CHANGELOG.md                          # NEW
LICENSE                               # NEW (MIT)
CONTRIBUTING.md                       # NEW
.github/PULL_REQUEST_TEMPLATE.md      # NEW
```

**Acceptance:** public repo link + demo video + deck ready before 5 Aug 11:59 PM MYT.

---

## Phase 6 — Post-hackathon productization 💤

- Swap `MockUSDC` → canonical USDC; deploy to Base mainnet.
- Multi-attestation / re-verification versioning per batch (attestation history, not one-shot).
- ERC-8004 agent identity + reputation for the verification agent.
- Multi-agent verification quorum (N independent agents must agree before release).
- Real document ingestion (S3/R2 upload, OCR pipeline, EXIF/tamper detection).
- Role-based org accounts, API keys, billing.

---

## Immediate cleanups (housekeeping, do anytime)

- `packages/web/tsconfig.tsbuildinfo` is tracked but is a build artifact → gitignore + `git rm --cached`.
- Add root `LICENSE` + `CHANGELOG.md`.
- Consider a root `docs/INDEX.md` linking all docs.

---

## Full target file architecture

Current tree with planned additions marked `(NEW)`. Unmarked entries exist today.

```
chainhack/
├─ .github/                                    (NEW, Phase 4e/5)
│  ├─ workflows/{ci,deploy,slither}.yml        (NEW)
│  ├─ dependabot.yml                           (NEW)
│  └─ PULL_REQUEST_TEMPLATE.md                 (NEW)
├─ demo/
│  ├─ clean/{invoice,bill-of-lading}.txt
│  └─ fraud/{invoice,bill-of-lading}.txt
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ DEMO.md
│  ├─ DEMO_DATA.md
│  ├─ ROADMAP.md                               (this file)
│  ├─ SPEC.md
│  ├─ SUBMISSION.md
│  ├─ SECURITY.md                              (NEW, Phase 4f)
│  ├─ PITCH.md                                 (NEW, Phase 5)
│  └─ media/                                   (NEW, Phase 5)
├─ packages/
│  ├─ contracts/            (Foundry — 4 contracts, 55 tests)
│  │  ├─ src/{ProvenanceRegistry,AttestationRegistry,SettlementEscrow,MockUSDC}.sol
│  │  ├─ src/interfaces/{IProvenanceRegistry,IAttestationRegistry}.sol
│  │  │             └─ ISettlementEscrow.sol   (NEW, Phase 4d)
│  │  ├─ test/*.t.sol  └─ Arbitration.t.sol    (NEW, Phase 4d)
│  │  ├─ script/Deploy.s.sol
│  │  ├─ scripts/export-abis.mjs
│  │  ├─ audit/                                (NEW, Phase 4f)
│  │  └─ deployments/base-sepolia.json         (NEW real, Phase 3)
│  ├─ shared/              (typed ABI/type/address layer, 61 tests)
│  │  └─ src/{abis/,addresses,chains,decoders,errors,types,index}.ts
│  ├─ agent/               (Fastify + Claude verification, 73 tests)
│  │  └─ src/
│  │     ├─ anthropic/{client,real-client,document-parser,tools}.ts
│  │     ├─ chain/{client,viem-client}.ts  └─ nonce-manager.ts   (NEW, 4b)
│  │     ├─ domain/{crosscheck,findings,scoring,types}.ts
│  │     ├─ http/routes/{verify,health,jobs}.ts └─ webhooks.ts   (NEW, 4b)
│  │     ├─ jobs/store.ts  └─ {queue,worker}.ts                  (NEW, 4b)
│  │     ├─ observability/{metrics,tracing}.ts                   (NEW, 4b)
│  │     ├─ orchestrator/orchestrator.ts
│  │     └─ verdict/pinner.ts
│  ├─ web/                 (Next.js 15 dApp, 80 tests)
│  │  └─ src/
│  │     ├─ app/{supplier,buyer,verifier,deals/[batchId]}/page.tsx
│  │     │      └─ {disputes,dashboard}/page.tsx                 (NEW, 4c)
│  │     ├─ components/{forms,ui,verifier}/ + panels
│  │     │      └─ DisputeResolver.tsx                           (NEW, 4c)
│  │     ├─ hooks/*  └─ useDisputes.ts                           (NEW, 4c)
│  │     └─ lib/*
│  ├─ infra/               (Supabase + IPFS, 45 tests)
│  │  ├─ src/{supabase,ipfs,hash,env,errors,types,index}.ts
│  │  ├─ schema.sql  └─ docs/DEPLOY.md
│  ├─ indexer/                                 (NEW package, Phase 4a)
│  │  └─ src/handlers/{provenance,attestation,escrow}.ts + schema.ts
│  └─ subgraph/                                (NEW, alt to indexer)
├─ scripts/
│  ├─ local-e2e.sh
│  ├─ seed-verify.sh
│  ├─ deploy-base-sepolia.sh                   (NEW, Phase 3)
│  └─ live-e2e.sh                              (NEW, Phase 3)
├─ .env / .env.example
├─ README.md · CHANGELOG.md (NEW) · LICENSE (NEW) · CONTRIBUTING.md (NEW)
├─ package.json · pnpm-workspace.yaml · pnpm-lock.yaml
```

---

## Recommended sequencing (given ~5 days to 5 Aug deadline)

1. **Now (no blockers):** Phase 4e CI + 4f security pass + cleanups + Phase 5 docs (LICENSE, CHANGELOG, PITCH) — all doable without external creds, parallelizable across agents.
2. **When you provide a funded key:** Phase 3 live deploy + real demo tx links.
3. **When you provide a GitHub remote:** Phase 5 push + tag.
4. **If time remains:** Phase 4a indexer and 4c dispute UX (highest product-value adds).
5. **After the hackathon:** Phase 6.
```
