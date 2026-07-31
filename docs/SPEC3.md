# ProofChain — Full Platform Catalog (SPEC3): scale to ~100 per package

> Extends `SPEC.md` + `SPEC2.md`. Target: each package (`contracts`, `api`, `web`, `agent`,
> `shared`, `infra`) grows to ~100 files of REAL, integrated, tested functionality. This
> document is the catalog the expansion waves build against. Same principles as SPEC2
> (interfaces-first, AddressBook, Roles, SafeERC20, events, tests). Everything must compile,
> integrate, and pass tests — breadth, never filler.

## The unique real-world thesis

ProofChain is the **on-chain operating system for Industrial 5.0 trade** — provenance,
AI verification, and settlement fused with the financial + compliance rails real supply
chains actually need. Differentiators we lean into (these make it unique, not another DeFi clone):

- **EU Digital Product Passport (DPP)** — the 2027 EU regulation mandating a digital passport
  for products. We implement a compliant, on-chain DPP with lifecycle events. (Flagship angle.)
- **AI attestation as the trust primitive** — every financial/compliance action is gated by an
  AI verification score, reconciled deterministically. Finance can't move on unverified goods.
- **Real trade-finance instruments** — Letters of Credit, factoring, PO financing, dynamic
  discounting, securitized receivable tranches — not toy lending.
- **Parametric + cargo insurance** driven by IoT/oracle checkpoints (cold-chain breach → payout).
- **Worker-centric (the "5.0" human angle)** — verifiable worker credentials, safety training,
  and stablecoin payroll tied to delivery milestones.

---

## CONTRACTS — target ~100 (SPEC2 ships ~60; add these ~45)

New module dirs under `packages/contracts/src/`. Interfaces-first + AddressBook as before.

### `src/tradefinance/` (10)
LetterOfCredit, BillOfExchange, FactoringAgreement, PurchaseOrderFinancing,
DynamicDiscounting, SupplyChainFinance, ReceivableSecuritization (tranching),
TrancheToken(ERC20), CreditLineManager, GuaranteeRegistry.

### `src/compliance/` (10)
SanctionsScreening, AMLRegistry, TradeComplianceEngine, CertificateOfOrigin,
PhytosanitaryCertificate, HalalCertification, ProductRecallRegistry, ExportLicenseRegistry,
DutyAndTariffCalculator, CustomsDeclaration.

### `src/dpp/` (7) — Digital Product Passport (flagship)
DigitalProductPassport(ERC721), DPPLifecycleRegistry, MaterialComposition, RepairabilityIndex,
RecyclingRegistry, DPPDataCarrier (GS1/QR link), DPPComplianceOracle.

### `src/logistics/` (8)
FreightBooking, ColdChainMonitor, BondedWarehouse, FleetRegistry, RouteAttestation,
CustomsBonded, ContainerRegistry, LastMileProofOfDelivery.

### `src/commodities/` (6)
CommodityToken(ERC20), HarvestRegistry, GradingRegistry, StorageReceipt, PriceOracle,
CommodityVault.

### `src/energy/` (5)
RenewableEnergyCertificate(ERC1155), EmissionsTrading, WaterCredit, BiodiversityCredit,
GreenBondIssuer.

### `src/workforce/` (5) — the human-centric 5.0 layer
WorkerCredential(ERC721 soulbound), SafetyTrainingRegistry, MilestonePayroll,
SkillAttestation, LaborComplianceRegistry.

### `src/data/` (5)
IoTSensorRegistry, QualityInspection, LabTestAttestation, OracleAggregator, DataMarketplace.

*(Each contract: real logic, `I<Name>.sol` interface, AddressBook wiring, Foundry tests in
`test/<module>/`. Extend `DeployPlatform.s.sol` to deploy + register + wire roles, and
`export-abis.mjs` to dump every ABI to `shared/src/abis/`.)*

---

## API `@proofchain/api` — target ~100 files

For EACH new contract domain add a route file (`src/routes/<domain>.ts`) with list/detail/
search/mutation-proxy endpoints. Plus platform-wide services:

- **Indexer handlers** — `src/indexer/handlers/<domain>.ts` for every contract group (~30 files).
- **Domain services** — `src/services/<domain>.ts` aggregating chain+db per domain (~25 files).
- **Cross-cutting routes** — `auth` (SIWE), `webhooks`, `notifications`, `exports` (CSV/PDF),
  `reports`, `admin`, `feeds` (RSS/JSON), `graphql` gateway, `subscriptions` (SSE/WS),
  per-domain `analytics/*`.
- **Repositories** — `src/repositories/<table>.ts` typed data-access per Supabase table.
- Tests (vitest, mocked chain+db) for the non-trivial services/routes.

Layout: `src/routes/` (~45), `src/services/` (~25), `src/repositories/` (~20),
`src/indexer/handlers/` (~30) — comfortably ~100+.

---

## WEB `@proofchain/web` — target ~100 files

A page per resource + supporting components/hooks. New route groups under `src/app/`:

- **Trade finance:** `/trade-finance`, `/letters-of-credit` (+`/[id]`), `/factoring`,
  `/po-financing`, `/dynamic-discounting`, `/securitization`, `/tranches/[id]`, `/credit-lines`.
- **Compliance:** `/compliance`, `/sanctions`, `/aml`, `/certificates` (+`/origin`,
  `/phytosanitary`, `/halal`), `/recalls`, `/customs`, `/duties`.
- **DPP:** `/passports` (+`/[tokenId]`), `/passports/scan`, `/materials`, `/recycling`, `/repairability`.
- **Logistics:** `/logistics`, `/freight`, `/cold-chain`, `/warehouses`, `/fleet`,
  `/containers/[id]`, `/proof-of-delivery`.
- **Commodities:** `/commodities` (+`/[symbol]`), `/harvests`, `/grading`, `/storage-receipts`.
- **Energy/ESG:** `/energy`, `/recs`, `/emissions-trading`, `/water-credits`, `/biodiversity`, `/green-bonds`.
- **Workforce:** `/workforce`, `/credentials/[address]`, `/safety-training`, `/payroll`, `/skills`.
- **Data/oracle:** `/sensors`, `/inspections`, `/lab-tests`, `/oracles`, `/data-market`.
- **Platform:** `/analytics/*` per domain, `/reports`, `/notifications`, `/settings`, `/onboarding`, `/docs`.

Each page: real data via `lib/api.ts` + wagmi writes, zod forms, loading/empty/error states.
Page-specific components under `src/components/<domain>/` and hooks under `src/hooks/`. Pages
(~55) + domain components (~30) + hooks (~20) ≈ ~100+. Extend the shared Nav with all sections.

---

## AGENT `@proofchain/agent` — target ~100 files (multi-skill verification)

Grow the single verifier into a **multi-document, multi-skill AI verification engine**:

- **Document parsers** `src/parsers/<doctype>.ts` — invoice, bill_of_lading, packing_list,
  certificate_of_origin, customs_declaration, inspection_report, lab_report, insurance_cert,
  letter_of_credit, phytosanitary, halal_cert, delivery_note, weight_certificate,
  dangerous_goods, cold_chain_log (~15).
- **Cross-check rule packs** `src/checks/<domain>.ts` — trade, customs, quality, cold-chain,
  sanctions, quantity/price, dpp-completeness (~12).
- **Risk models** `src/risk/<model>.ts` — fraud, credit, counterparty, route, esg (~6).
- **Agent skills/tools** `src/tools/<tool>.ts` — one per capability the tool-calling loop exposes (~15).
- **Scorers** `src/scoring/<dimension>.ts` — authenticity, consistency, compliance, risk,
  completeness + the reconciler (~8).
- **Pipelines** `src/pipelines/<flow>.ts` — verification, financing-eligibility,
  insurance-underwriting, dpp-issuance, compliance-screening (~8).
- **HTTP routes** for each pipeline + jobs + health (~10). Plus chain writers, config, util.
- Tests for every parser/check/scorer/pipeline (mocked Anthropic + chain). Keep everything
  offline-testable (injectable clients).

---

## SHARED `@proofchain/shared` — naturally ~100+

- `src/abis/*.json` — one per contract (~100 ABI files) + `abis/index.ts`.
- `src/types/<domain>.ts` — types per domain (~25).
- `src/addresses.ts` — every contract key. `src/constants/<domain>.ts` role/enum constants (~10).
- `src/decoders/<domain>.ts` — event decoders per domain (~15). `src/chains.ts`, `src/index.ts`.
- vitest for decoders/helpers.

## INFRA `@proofchain/infra` — target ~100 files

- `schema/<domain>.sql` — per-domain schema modules composed into `schema.sql` (~20).
- `src/repositories/<table>.ts` — typed repos (~30). `src/migrations/<n>_*.sql` (~15).
- `src/storage/` — IPFS/Pinata, S3/R2 adapter, local fallback. `src/queue/` — job queue.
- `src/notifications/` — email, webhook, in-app channels. `src/cache/`. `src/events/` — outbox.
- Tests per repository/adapter (mocked).

---

## Build discipline (applies to every expansion wave)

1. Interfaces + AddressBook keys FIRST for any new contract domain; implement against interfaces.
2. Write-only in parallel within a domain; a per-wave integration agent compiles/tests/wires/exports ABIs.
3. Never break existing tests. Every new contract has tests; every new service/parser/scorer has tests.
4. After each wave: `forge test` green, `pnpm -r typecheck/build/test` green, ABIs exported, deploy updated.
5. Real logic only. If a contract/endpoint/page exists, it does something real and is exercised by a test.

## Sequencing (waves run AFTER the SPEC2 foundation build completes — never concurrently)

- **Wave A (contracts to ~100):** tradefinance + compliance + dpp + logistics + commodities +
  energy + workforce + data modules → contracts-integrate → export ABIs.
- **Wave B (shared to ~100):** types/decoders/constants/addresses for all new domains.
- **Wave C (agent to ~100):** parsers + checks + risk + tools + scorers + pipelines + routes.
- **Wave D (infra to ~100):** per-domain schema + repositories + migrations + storage/queue/notifications.
- **Wave E (api to ~100):** routes + services + repositories + indexer handlers for all domains.
- **Wave F (web to ~100):** all new page groups + domain components + hooks + nav.
- **Wave G:** platform-integrate + verify (whole workspace green, true counts reported).
