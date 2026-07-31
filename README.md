# ProofChain

**AI-verified supply-chain provenance with autonomous on-chain settlement.**

Built for **ChainHack 2026 / NeuralLedger 5.0** — Industrial 5.0 with AI × Web3.

> An AI verification agent inspects a shipment's documents, cross-checks them against an
> on-chain provenance trail, scores fraud/anomaly risk, writes a signed attestation
> on-chain, and — for clean shipments — releases stablecoin payment to the supplier from
> escrow. Fraudulent shipments are held and flagged for dispute. **AI audits, the
> blockchain enforces.**

---

## Why it matters (Industrial 5.0)

Global supply chains lose enormous value to document fraud, opaque provenance, and slow,
trust-heavy settlement. ProofChain removes the human bottleneck from the *audit-and-pay*
loop: an AI agent does the verification work, and a smart-contract escrow enforces the
outcome trustlessly. No invoice gets paid until the shipment is provably clean.

### Tracks addressed
- **Industrial 5.0 Applications** — supply-chain transparency, operations automation
- **AI × Web3** — an autonomous AI agent that reads state and writes signed attestations on-chain
- **Real-World Finance** — stablecoin (USDC) escrow + conditional settlement
- **Infrastructure & Developer Tools** — reusable attestation + settlement primitives

---

## How it works

```
Supplier ── register batch + checkpoints ──▶ ProvenanceRegistry (on-chain ground truth)
Supplier ── upload invoice + bill of lading ─▶ AI Verification Agent
                                                  │  reads provenance (viem)
                                                  │  parses docs (Claude vision)
                                                  │  cross-checks + scores (bps)
                                                  ▼
                                            AttestationRegistry ◀── signed attest() (AGENT_ROLE)
                                                  │
Buyer ── approve + fund USDC ──▶ SettlementEscrow │ reads score
                                                  ▼
                          score >= threshold ? RELEASE to supplier : DISPUTE (hold for resolution)
```

The agent's score is **reconciled deterministically**: a rule-based score is recomputed
from finding severities and the *stricter* of (model score, rule score) wins — so a
fraudulent shipment can never be waved through by a nondeterministic model output.

---

## Monorepo

| Package | Stack | Purpose |
|---------|-------|---------|
| [`packages/contracts`](packages/contracts) | Foundry / Solidity 0.8.24 + OpenZeppelin | `ProvenanceRegistry`, `AttestationRegistry`, `SettlementEscrow`, `MockUSDC` |
| [`packages/shared`](packages/shared) | TypeScript + viem | Typed ABIs, addresses, on-chain struct types, verdict schemas |
| [`packages/agent`](packages/agent) | Fastify + `@anthropic-ai/sdk` + viem | AI verification service (tool-calling loop, on-chain attest/settle) |
| [`packages/web`](packages/web) | Next.js 15 + wagmi/viem/RainbowKit + Tailwind | dApp: supplier / buyer / verifier dashboard / deal detail |
| [`packages/infra`](packages/infra) | TypeScript | Supabase schema + client, IPFS pinning (Pinata + local fallback) |

**Target chain:** Base Sepolia (`chainId 84532`). A self-contained `MockUSDC` (6 decimals)
makes the full flow runnable without external accounts; `SettlementEscrow` accepts any
ERC-20 so real USDC swaps in for mainnet.

---

## Quickstart

```bash
pnpm install

# 1. Contracts — build + test (Foundry)
pnpm --filter @proofchain/contracts build
pnpm --filter @proofchain/contracts test        # 55 tests

# 2. Everything — build, typecheck, test
pnpm -r build && pnpm -r typecheck && pnpm -r test   # 314 tests total

# 3. Prove the full flow locally (no API key / network needed):
#    spins up anvil, deploys, runs clean + fraud lifecycles, asserts outcomes
bash scripts/local-e2e.sh
```

Copy `.env.example` to `.env` and fill in credentials to run live (see
[`docs/DEPLOY`](packages/infra) and [`docs/SPEC.md`](docs/SPEC.md)).

### Run the stack

```bash
pnpm --filter @proofchain/agent dev    # verification API on :8080
pnpm --filter @proofchain/web dev      # dApp on :3000
```

---

## Test & verification status

| Suite | Result |
|-------|--------|
| contracts (`forge test`) | **55 passed** — happy path, every revert, access control, reentrancy, threshold boundaries |
| shared (vitest) | **61 passed** |
| agent (vitest) | **73 passed** — scoring reconciliation, cross-checks, handlers (mocked Anthropic + chain) |
| infra (vitest) | **45 passed** |
| web (vitest) | **80 passed** |
| **Total** | **314 passed** |

Full lifecycle verified on a live node (`scripts/local-e2e.sh`): clean → **Released**,
fraud → **Disputed** → **Refunded**.

---

## Production notes

- No hardcoded secrets — all credentials via env, validated at startup; `.env` is gitignored.
- Input validation at every boundary (zod on TS, custom errors on Solidity).
- Contracts use `AccessControl`, `SafeERC20`, `ReentrancyGuard`, `Pausable`; escrow settlement is `nonReentrant`.
- Agent clients (Anthropic + viem) are injectable/mockable — the full test suite runs offline.
- Security + TypeScript review pass applied before this state (18 findings fixed, incl. a
  critical address-casing runtime bug and fee-on-transfer fund accounting).

See [`docs/SPEC.md`](docs/SPEC.md) for the full interface contract and
[`docs/DEMO.md`](docs/DEMO.md) for the demo script.
