# ChainHack 2026 — ProofChain Submission

## One-liner
AI-verified supply-chain provenance with autonomous on-chain settlement — an AI agent
audits shipments, a smart-contract escrow enforces payment. **AI audits, the blockchain enforces.**

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
Everything in this repository was built during the ChainHack window. A monorepo of 5 packages:
- **contracts** — 4 Solidity contracts (`ProvenanceRegistry`, `AttestationRegistry`,
  `SettlementEscrow`, `MockUSDC`) with OpenZeppelin access control / SafeERC20 / reentrancy
  guard / pausable, a deploy script, and 55 Foundry tests (happy path, every revert, access
  control, reentrancy, threshold boundaries).
- **shared** — typed ABI/type/address layer (viem, Base Sepolia), verdict schemas.
- **agent** — Fastify service running a Claude tool-calling verification pipeline with a
  deterministic scoring guard, on-chain attest/settle, fully mockable (73 tests).
- **web** — Next.js 15 dApp (wagmi/viem/RainbowKit): supplier, buyer, verifier dashboard,
  deal detail (80 tests).
- **infra** — Supabase schema + client and IPFS pinning with a local fallback (45 tests).

**314 tests total, all passing.** Full lifecycle verified on a live chain via
`scripts/local-e2e.sh` (clean → Released, fraud → Disputed → Refunded).

## Tech stack
Solidity 0.8.24 · Foundry · OpenZeppelin · TypeScript · viem · wagmi · RainbowKit ·
Next.js 15 · Fastify · Anthropic Claude (`@anthropic-ai/sdk`) · zod · Supabase · IPFS/Pinata ·
Base Sepolia (`chainId 84532`).

## Repository
- Code: this repo (GitHub link goes here at submission).
- Architecture: [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)
- Interface spec: [`docs/SPEC.md`](./SPEC.md)
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
