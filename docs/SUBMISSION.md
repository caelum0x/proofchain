# ChainHack 2026 — ProofChain Submission

## One-liner
The on-chain operating system for Industrial 5.0 trade — an AI agent audits shipments and its
signed attestation becomes the trust primitive that gates settlement, financing, insurance,
compliance, and the EU Digital Product Passport. **AI audits, the blockchain enforces.**

## Problem
Global supply chains lose enormous value to document fraud, opaque provenance, and slow,
trust-heavy settlement. Every shipment needs a human to audit documents before anyone gets
paid — expensive, slow, and error-prone.

## Solution
ProofChain removes the human from the *audit-and-pay* loop. Suppliers record shipment
provenance on-chain. An AI verification agent parses shipment documents, cross-checks them
against that on-chain trail, scores fraud risk, and writes a **signed attestation** on-chain.
A `SettlementEscrow` releases stablecoin payment to the supplier **only** when the
attestation passes a threshold; fraudulent shipments are held for dispute.

The agent's score is **reconciled deterministically** — a rule-based score computed from
finding severities is compared against the model's score and the *stricter* wins — so a
fraudulent shipment cannot be waved through by nondeterministic model output.

## Tracks
- **Industrial 5.0 Applications** — supply-chain transparency & operations automation (primary)
- **AI × Web3** — autonomous AI agent that reads chain state and writes signed attestations
- **Real-World Finance** — USDC escrow with conditional, automated settlement
- **Infrastructure & Developer Tools** — reusable provenance + attestation + settlement primitives

## What we built during the hackathon
Everything in this repository was built during the ChainHack window — a full platform, a
monorepo of 6 packages:
- **contracts** — **120 Solidity contracts** across 19 modules (core provenance/attestation/
  settlement, identity, reputation & bonds, invoice finance/RWA, trade finance, compliance,
  EU Digital Product Passport, logistics, commodities, energy/ESG, workforce, insurance,
  disputes & governance, marketplace, data/oracle, rewards) — interfaces-first with a central
  AddressBook registry, OpenZeppelin access control / SafeERC20 / reentrancy guard / pausable,
  a platform deploy script, and **1468 Foundry tests**.
- **shared** — typed ABI/type/address layer (117 ABIs, per-domain types, viem, Base Sepolia) — **235 tests**.
- **agent** — multi-skill AI verification engine (6 auto-collecting registries: 15+ document
  parsers, cross-check packs, risk models, scoring dimensions with a deterministic reconciler,
  Claude tool-calling, and 8 pipelines — financing eligibility, insurance underwriting, DPP
  issuance, compliance screening, quality grading, ESG), on-chain attest/settle, fully mockable — **380 tests**.
- **api** — platform backend (Fastify): ~98 routes, ~52 domain services, and an event indexer
  feeding Supabase across every domain — **481 tests**.
- **web** — Next.js 15 product dApp on a full design system (~120 pages: dashboards, explorers,
  finance, compliance, DPP, logistics, ESG, workforce, governance, markets) — **178 tests**.
- **infra** — Supabase repositories + per-domain schema modules and storage/queue/notifications/
  cache/events adapters with local fallbacks — **203 tests**.

**~2,945 tests total, all passing.** `pnpm -r typecheck` + `next build` green across the
workspace. Core lifecycle verified on a live chain via `scripts/local-e2e.sh`
(clean → Released, fraud → Disputed → Refunded).

## Tech stack
Solidity 0.8.24 · Foundry · OpenZeppelin (ERC20/721/1155/Votes/Governor/Timelock) · TypeScript ·
viem · wagmi · RainbowKit · Next.js 15 · Tailwind · Fastify · Anthropic Claude
(`@anthropic-ai/sdk`) · zod · Supabase · IPFS/Pinata · TanStack Query · Base Sepolia (`chainId 84532`).

## Repository
- Code: this repo (GitHub link goes here at submission).
- Architecture: [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)
- Interface specs: [`docs/SPEC.md`](./SPEC.md) · [`docs/SPEC2.md`](./SPEC2.md) · [`docs/SPEC3.md`](./SPEC3.md)
- Web design system: [`docs/WEB_DESIGN.md`](./WEB_DESIGN.md)
- Roadmap: [`docs/ROADMAP.md`](./ROADMAP.md)
- Demo script: [`docs/DEMO.md`](./DEMO.md)
- Reproducible proof: `scripts/local-e2e.sh`

## Rule-compliance checklist
- [x] Original work, built during the hackathon period.
- [x] Public GitHub repository with commit history within the window.
- [x] No pre-existing project reused (repo initialized fresh for this hackathon).
- [x] GitHub username / repo link provided at registration & submission.
- [x] Clear separation of what was built during the hackathon (this entire repo).
- [x] No hardcoded secrets; `.env` gitignored; `.env.example` documents required vars.

## Roadmap (post-hackathon)
- Swap `MockUSDC` for canonical USDC and deploy to Base mainnet.
- Multi-attestation / re-verification versioning per batch.
- Agent horizontal scaling + job queue (Supabase-backed) and webhooks.
- Dispute-resolution UX and an arbitration role beyond admin refund.
- ERC-8004 agent identity + reputation for the verification agent.
