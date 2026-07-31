# ProofChain

**The on-chain operating system for Industrial 5.0 trade — AI-verified provenance, finance, and compliance.**

Built for **ChainHack 2026 / NeuralLedger 5.0** — Industrial 5.0 with AI × Web3.

> An AI verification agent inspects a shipment's documents, cross-checks them against an
> on-chain provenance trail, scores fraud/anomaly risk, and writes a signed attestation
> on-chain. That attestation is the **trust primitive** the whole platform runs on: escrow
> releases stablecoin payment only for verified shipments, invoices become financeable,
> insurance pays out, compliance clears, and a Digital Product Passport is issued.
> **AI audits, the blockchain enforces.**

---

## Why it matters (Industrial 5.0)

Global supply chains lose enormous value to document fraud, opaque provenance, slow
trust-heavy settlement, and fragmented compliance. ProofChain fuses **AI verification** with
the **financial and regulatory rails real trade needs** — so nothing moves (payment,
financing, insurance, customs clearance) until goods are provably verified.

### Tracks addressed
- **Industrial 5.0 Applications** — supply-chain transparency, logistics, operations, workforce
- **AI × Web3** — an autonomous multi-skill AI agent that reads state and writes signed attestations
- **Real-World Finance** — USDC settlement, invoice financing, factoring, securitization, insurance
- **Infrastructure & Developer Tools** — reusable provenance, attestation, settlement, and identity primitives
- **Consumer / Open Innovation** — EU Digital Product Passport, ESG/carbon, rewards

---

## The core loop

```
Supplier ── register batch + checkpoints ──▶ ProvenanceRegistry (on-chain ground truth)
Supplier ── upload trade documents ─────────▶ AI Verification Agent (multi-skill)
                                                  │  reads provenance (viem)
                                                  │  parses 15+ doc types (Claude)
                                                  │  cross-check packs + risk models + scorers
                                                  ▼
                                            AttestationRegistry ◀── signed attest() (AGENT_ROLE)
                                                  │  the trust primitive
                 ┌────────────────────────────────┼───────────────────────────────┐
                 ▼                ▼                 ▼               ▼                ▼
          SettlementEscrow  InvoiceFinancing   InsurancePool  DigitalProduct    Compliance
          release/dispute   advance/repay      policy/claim   Passport issue    clear/flag
```

The agent's score is **reconciled deterministically**: a rule-based score is recomputed from
finding severities and the *stricter* of (model score, rule score) wins — so a fraudulent
shipment can never be waved through by a nondeterministic model output.

---

## Platform domains (~120 contracts across 19 modules)

| Group | Modules |
|-------|---------|
| **Core provenance** | ProvenanceRegistry · AttestationRegistry · SettlementEscrow · AddressBook · Roles |
| **Settlement & payments** | PaymentRouter · StablecoinRegistry · FeeManager · Treasury · EscrowFactory |
| **Identity** | Organization / Supplier / Buyer / Carrier / KYC registries · IdentityResolver |
| **Reputation & bonds** | ReputationEngine · SupplierBond · StakeManager · SlashingController · ScoreOracle |
| **Invoice finance / RWA** | InvoiceNFT · InvoiceFinancing · FinancingPool · LenderVault · Discount/Yield/Repayment |
| **Trade finance** | LetterOfCredit · BillOfExchange · Factoring · POFinancing · DynamicDiscounting · Securitization · TrancheToken · CreditLines · Guarantees |
| **Compliance** | Sanctions · AML · TradeCompliance · CertificateOfOrigin · Phytosanitary · Halal · Recalls · ExportLicense · Duties · Customs |
| **Digital Product Passport** | DigitalProductPassport (EU DPP) · Lifecycle · Materials · Repairability · Recycling · DataCarrier · ComplianceOracle |
| **Logistics** | Freight · ColdChain · BondedWarehouse · Fleet · RouteAttestation · Containers · ProofOfDelivery |
| **Commodities** | CommodityToken · Harvest · Grading · StorageReceipt · PriceOracle · CommodityVault |
| **Energy / ESG** | RenewableEnergyCertificate · EmissionsTrading · Water/Biodiversity credits · GreenBonds · ESGRegistry · Carbon |
| **Workforce (5.0)** | WorkerCredential (soulbound) · SafetyTraining · MilestonePayroll · Skills · LaborCompliance |
| **Insurance** | InsurancePool · PolicyManager · ClaimsProcessor · PremiumCalculator · RiskPool |
| **Disputes & governance** | DisputeArbitration · ArbiterStaking · GovernanceToken · Governor · Timelock |
| **Marketplace** | ListingRegistry · FinancingMarketplace · AuctionHouse · OrderBook · BidManager |
| **Data / oracle** | IoTSensorRegistry · QualityInspection · LabTest · OracleAggregator · DataMarketplace |
| **Rewards** | LoyaltyPoints · RewardsDistributor · StakingRewards · ReferralProgram |

---

## Monorepo

| Package | Stack | Scope |
|---------|-------|-------|
| [`packages/contracts`](packages/contracts) | Foundry / Solidity 0.8.24 + OpenZeppelin | **120 contracts** across 19 modules (interfaces-first + AddressBook registry) |
| [`packages/shared`](packages/shared) | TypeScript + viem | Typed ABIs (117), addresses, per-domain struct types, verdict schemas |
| [`packages/agent`](packages/agent) | Fastify + `@anthropic-ai/sdk` + viem | Multi-skill AI verification engine: 15+ doc parsers, check packs, risk models, scorers, 8 pipelines |
| [`packages/api`](packages/api) | Fastify + Supabase + viem | Platform backend: ~98 routes, ~52 services, event indexer |
| [`packages/web`](packages/web) | Next.js 15 + wagmi/viem/RainbowKit + Tailwind | ~120-page product dApp on a full design system |
| [`packages/infra`](packages/infra) | TypeScript + Supabase | Repositories, per-domain schema, storage/queue/notifications/cache adapters |

**Target chain:** Base Sepolia (`chainId 84532`). A self-contained `MockUSDC` (6 decimals)
makes the core flow runnable without external accounts; contracts accept any ERC-20 so real
USDC/stablecoins swap in for mainnet.

---

## Quickstart

```bash
pnpm install

# Contracts — build + test (Foundry): 1468 tests
pnpm --filter @proofchain/contracts test

# Everything — build, typecheck, test across all packages
pnpm -r build && pnpm -r typecheck && pnpm -r test

# Prove the core flow locally (no API key / network needed):
#   spins up anvil, deploys, runs clean + fraud lifecycles, asserts outcomes
bash scripts/local-e2e.sh
```

### Run the stack

```bash
pnpm --filter @proofchain/agent dev    # AI verification API  (:8080)
pnpm --filter @proofchain/api dev      # platform backend API (:8081)
pnpm --filter @proofchain/web dev      # product dApp          (:3000)
```

Copy `.env.example` to `.env` for live credentials. See [`docs/SPEC.md`](docs/SPEC.md),
[`docs/SPEC2.md`](docs/SPEC2.md), [`docs/SPEC3.md`](docs/SPEC3.md) for interface contracts,
[`docs/WEB_DESIGN.md`](docs/WEB_DESIGN.md) for the design system, and [`docs/DEMO.md`](docs/DEMO.md).

---

## Test & verification status

| Suite | Result |
|-------|--------|
| contracts (`forge test`) | **1468 passed** (120 suites) — happy paths, reverts, access control, reentrancy, token standards |
| shared (vitest) | **235 passed** |
| agent (vitest) | **380 passed** — parsers, checks, risk, scoring reconciliation, pipelines (mocked Anthropic + chain) |
| infra (vitest) | **203 passed** |
| api (vitest) | **481 passed** |
| web (vitest) | **178 passed** |
| **Total** | **2,945 passed** |

`pnpm -r typecheck` and `next build` green across the workspace. Core lifecycle verified on a
live node (`scripts/local-e2e.sh`): clean → **Released**, fraud → **Disputed** → **Refunded**.

---

## Architecture principles

- **Interfaces-first + AddressBook registry** — ~120 contracts integrate through interfaces and a
  single on-chain address registry, never hardcoded cross-wiring.
- **AI attestation as the trust primitive** — every financial/compliance action is gated by a
  verified, deterministically-reconciled score.
- **No hardcoded secrets** — all credentials via env, validated at startup; `.env` gitignored.
- **Validation at every boundary** — zod on TS, custom errors on Solidity.
- **Money safety** — `AccessControl`, `SafeERC20`, `ReentrancyGuard`, `Pausable`; fund movement is `nonReentrant`.
- **Offline-testable** — Anthropic + chain + DB clients are injectable/mockable; the full suite runs without network.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md).
