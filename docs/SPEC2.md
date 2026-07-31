# ProofChain — Platform Expansion Spec (SPEC2)

> Extends `docs/SPEC.md`. This turns the core (provenance → attestation → settlement) into a
> full **Industrial 5.0 supply-chain finance platform**: identity, reputation, invoice
> financing (RWA), payments/treasury, insurance, disputes & governance, tokenization/ESG,
> a marketplace, and rewards. ~60 contracts across 11 modules, a full backend API, and a
> large web app. This is a PRODUCTION build — real logic, tests that pass, no stubs left dead.

## Architectural principles (MANDATORY — these keep it coherent at scale)

1. **Interfaces-first.** Every contract's external surface lives in
   `packages/contracts/src/interfaces/I<Name>.sol`. Contracts import PEER interfaces, never
   peer implementations. This lets modules compile independently.
2. **AddressBook registry.** A single `AddressBook` contract maps `bytes32 key → address`.
   Every contract resolves its dependencies through the AddressBook (set once at deploy),
   NOT via constructor hardcoding of every peer. Keys are `keccak256("ProvenanceRegistry")` etc.
   Provide a `ProofChainAccess` base that holds the AddressBook and a `_addr(key)` helper.
3. **Roles.** A `Roles` library defines every `bytes32` role constant used across modules
   (`REGISTRAR_ROLE`, `AGENT_ROLE`, `REPUTATION_UPDATER_ROLE`, `SLASHER_ROLE`, `ARBITER_ROLE`,
   `MINTER_ROLE`, `TREASURER_ROLE`, `POOL_MANAGER_ROLE`, `GOVERNOR_ROLE`, `KEEPER_ROLE`, ...).
   Use OpenZeppelin `AccessControl`/`AccessControlEnumerable`.
4. **Money safety.** All ERC20 transfers via `SafeERC20`; all fund-moving externals
   `nonReentrant`; snapshot balances for fee-on-transfer safety where funds are pulled.
5. **Module directories.** New contracts go in `packages/contracts/src/<module>/`. Do NOT move
   the existing root contracts (`ProvenanceRegistry`, `AttestationRegistry`, `SettlementEscrow`,
   `MockUSDC`) — the 314 existing tests must keep passing. `SettlementEscrow` is EXTENDED (see M2).
6. **Events for indexing.** Every state change emits an event — the backend indexer consumes them.
7. **Solidity 0.8.24 + OpenZeppelin.** ERC20/721/1155/Votes/Governor from `@openzeppelin/contracts`.

---

## Contract modules

Legend per contract: **Name** — purpose · key externals · key events · deps (via AddressBook).

### M0 — core (`src/core/`)
- **AddressBook** — key→address registry · `setAddress(bytes32,address)` (admin), `getAddress(bytes32)`, `requireAddress(bytes32)` · `AddressSet`.
- **Roles** (library) — role constant definitions.
- **ProofChainAccess** (abstract base) — holds AddressBook, `_addr(key)`, `AccessControl`.
- **Pauser** — global pause guardian other modules can consult.
- *(existing `MockUSDC` stays at src root.)*

### M1 — provenance extensions (`src/provenance/`)
- **CheckpointOracle** — trusted IoT/carrier checkpoint feeds · `pushCheckpoint(batchId, location, temp, dataHash)` (KEEPER) · `CheckpointPushed` · deps ProvenanceRegistry.
- **ProvenanceFactory** — batch-series/templated registration · `createSeries`, `registerFromSeries` · `SeriesCreated`.
- **BatchMetadataStore** — rich structured metadata off the hot path · `setMetadata(batchId, kvs)` · `MetadataSet`.

### M2 — settlement extensions (EXTEND `src/SettlementEscrow.sol` + `src/payments/`)
Extend `SettlementEscrow` (keep existing behavior/tests green) with:
- `payeeOverride[batchId]` + `setPayee(bytes32,address)` (only deal.supplier, state Funded) — release pays override if set (enables invoice financing assignment).
- `ARBITER_ROLE` + `arbiterRelease(bytes32)` (Disputed → Released to payee) and keep admin `refund`.
- Optional reputation hook: if AddressBook has `ReputationEngine`, call `recordOutcome` on release/dispute.
- **PaymentRouter** — multi-stablecoin payments, routes to escrow/treasury · `pay`, `route` · `Routed` · deps StablecoinRegistry, FeeManager, Treasury.
- **StablecoinRegistry** — allowlist of accepted tokens + decimals · `addToken`, `isAccepted` · `TokenAdded`.
- **FeeManager** — protocol fee bps per action, computes/collects · `feeFor(action, amount)`, `collect` · `FeeCollected` · deps Treasury.
- **Treasury** — holds protocol fees, admin withdrawals · `deposit`, `withdraw(TREASURER)` · `Deposit/Withdraw`.
- **EscrowFactory** — deploy per-deal or per-org escrows · `createEscrow` · `EscrowCreated`.
- **SettlementRouter** — orchestrates attest→settle→reputation→fees in one call · `settleFull(batchId)`.

### M3 — identity (`src/identity/`)
- **OrganizationRegistry** — orgs (name, type, metadata, admin) that suppliers/buyers belong to · `registerOrg`, `addMember` · `OrgRegistered/MemberAdded`.
- **SupplierRegistry** — supplier profiles · `registerSupplier(name, uri)`, `profileOf` · `SupplierRegistered`.
- **BuyerRegistry** — buyer profiles · same shape · `BuyerRegistered`.
- **CarrierRegistry** — logistics carriers (can push checkpoints) · `registerCarrier` · `CarrierRegistered`.
- **KYCRegistry** — attestation of KYC status per address by KYC_PROVIDER role · `setKyc(addr, level)`, `kycOf` · `KycSet`.
- **IdentityResolver** — unified `who(address) → (role, orgId, name)` read across registries.

### M4 — reputation & bonds (`src/reputation/`)
- **ReputationEngine** — on-chain reputation per supplier · `recordOutcome(supplier, passed, score)` (REPUTATION_UPDATER), `reputationOf → (avgScoreBps, totalDeals, passRateBps, disputes)` · `OutcomeRecorded` · consumed by escrow/router.
- **SupplierBond** — supplier stakes ERC20 bond · `depositBond`, `withdrawBond` (only unlocked), `bondOf` · `BondDeposited/Withdrawn` · deps StablecoinRegistry.
- **StakeManager** — generic stake accounting reused by bonds/arbiters/pools · `stake`, `unstake`, `lock`, `stakeOf`.
- **SlashingController** — slashes bonds/stakes on proven fraud · `slash(who, amount, reason)` (SLASHER) · `Slashed` · deps SupplierBond, Treasury.
- **ScoreOracle** — blends AI attestation score + history + KYC into a composite risk grade · `gradeOf(supplier) → uint8` · deps ReputationEngine, KYCRegistry.

### M5 — invoice financing / RWA (`src/finance/`)
- **InvoiceNFT** (ERC721) — each funded+attested deal mints a receivable NFT; tokenId = uint256(batchId) · `mintReceivable(batchId, to)` (MINTER), `tokenURI` · deps ProvenanceRegistry, AttestationRegistry.
- **ReceivableRegistry** — tracks receivable terms (face value, due, obligor) · `register`, `termsOf` · `ReceivableRegistered`.
- **InvoiceFinancing** — supplier lists an attested receivable at a discount; lender funds, becomes escrow payee via `SettlementEscrow.setPayee`; on release, lender repaid principal, remainder to supplier · `list(batchId, askAmount)`, `fund(batchId)`, `claim(batchId)` · `Listed/Funded/Claimed` · deps SettlementEscrow, AttestationRegistry, InvoiceNFT.
- **FinancingPool** — pooled lender capital auto-funds eligible receivables by risk grade · `deposit`, `withdraw`, `allocate(batchId)` · `Deposited/Allocated` · deps ScoreOracle, InvoiceFinancing, LenderVault.
- **LenderVault** (ERC4626-style) — tokenized shares of a FinancingPool · `deposit/mint/redeem`, `totalAssets`.
- **DiscountCalculator** — computes advance amount from face value, grade, tenor · `advanceFor(face, grade, days) → uint256` (pure/view).
- **YieldDistributor** — splits repayment yield to pool depositors · `distribute(poolId)` · `YieldDistributed`.
- **RepaymentController** — on settlement release, routes lender principal+fee then supplier remainder · `onSettle(batchId)`.

### M6 — insurance (`src/insurance/`)
- **InsurancePool** — capital backing shipment/credit insurance · `underwrite`, `deposit`, `withdraw` · deps StablecoinRegistry.
- **PolicyManager** — buyer/lender buys a policy on a batch · `buyPolicy(batchId, coverage)`, `policyOf` · `PolicyIssued` · deps PremiumCalculator, InsurancePool.
- **ClaimsProcessor** — files/pays claims on disputed+proven-loss batches · `fileClaim`, `approveClaim(ARBITER)`, `payout` · `ClaimFiled/Paid` · deps InsurancePool, DisputeArbitration.
- **PremiumCalculator** — premium from coverage + supplier grade · `premiumFor(coverage, grade) → uint256` (view) · deps ScoreOracle.
- **RiskPool** — reinsurance tranche absorbing tail losses · `topUp`, `cover`.

### M7 — disputes & governance (`src/governance/`)
- **DisputeArbitration** — staked arbiters vote on Disputed deals; majority → refund buyer or arbiterRelease supplier · `openDispute(batchId)`, `vote(batchId, refundBuyer)`, `resolve(batchId)` · `DisputeOpened/Voted/Resolved` · deps SettlementEscrow, ArbiterStaking, SlashingController.
- **ArbiterStaking** — stake to become an arbiter; slashable for bad votes · `stakeArbiter`, `unstakeArbiter`, `isArbiter` · deps StakeManager.
- **GovernanceToken** (ERC20Votes) — PROOF governance token · standard + `mint` (MINTER).
- **ProofChainGovernor** (OZ Governor) — proposals over protocol params (fees, thresholds) · standard governor.
- **ProofChainTimelock** (OZ TimelockController) — executes passed proposals.
- **ProposalRegistry** — human-readable proposal metadata index · `describe(proposalId, uri)`.

### M8 — tokenization & ESG (`src/esg/`)
- **BatchNFT** (ERC721) — tokenized bill of lading minted on registration; transferable title · `mint(batchId, to)` (MINTER), `tokenURI`.
- **WarehouseReceipt** (ERC721) — tokenized stored-goods receipt with quantity/location · `issue`, `redeem` · `Issued/Redeemed`.
- **CarbonCreditToken** (ERC1155) — tokenized carbon offsets per project id · `mint`, `retire(amount)` · `Retired` · deps SustainabilityOracle.
- **ESGRegistry** — ESG scores/attestations per batch/org · `setEsg(subject, score, uri)` · `EsgSet`.
- **SustainabilityOracle** — feeds emissions/energy data (KEEPER) · `pushEmissions(batchId, co2e)` · `EmissionsPushed`.
- **OffsetMarketplace** — buy/retire carbon credits against a batch's footprint · `offset(batchId, amount)` · deps CarbonCreditToken, ESGRegistry.

### M9 — marketplace (`src/marketplace/`)
- **ListingRegistry** — generic listings (receivables, NFTs, credits) · `createListing`, `cancelListing`, `listingOf` · `ListingCreated/Cancelled`.
- **FinancingMarketplace** — order book of receivable financing offers/bids · `makeOffer`, `takeOffer` · `OfferMade/Taken` · deps InvoiceFinancing, ListingRegistry.
- **AuctionHouse** — English auctions for InvoiceNFT/WarehouseReceipt · `startAuction`, `bid`, `settleAuction` · `AuctionStarted/Bid/Settled`.
- **OrderBook** — limit orders for tokenized assets · `placeOrder`, `matchOrders`, `cancel`.
- **BidManager** — escrows bids, refunds losers · `escrowBid`, `refundBid`.

### M10 — rewards & loyalty (`src/rewards/`)
- **LoyaltyPoints** (ERC20, non-transferable option) — points for on-time clean deliveries · `award(to, amount)` (MINTER).
- **RewardsDistributor** — merkle/streaming rewards to participants · `setRoot`, `claim(proof)` · `Claimed`.
- **StakingRewards** — stake PROOF/LP, earn emissions · `stake`, `getReward`, `exit`.
- **ReferralProgram** — referral attribution + payout · `refer`, `recordConversion`, `claimReferral`.
- **EmissionsController** — controls reward emission rate over epochs · `setEmissionRate`, `currentRate`.

**Deploy:** extend `script/Deploy.s.sol` (or add `script/DeployPlatform.s.sol`) to deploy the
AddressBook, register every module address, wire roles, and write ALL addresses to
`deployments/base-sepolia.json`. Export every ABI to `packages/shared/src/abis/` via `export-abis.mjs`.

---

## Backend API — new package `@proofchain/api` (`packages/api`)

Fastify + TypeScript service, SEPARATE from the verification agent. Reads chain (viem via
`@proofchain/shared`) + Supabase (`@proofchain/infra`). Includes a **poller/indexer** that
ingests events from all contracts into Supabase, and serves REST for the web app.
`zod` on every boundary, `{success,data,error}` envelope, pino logging, health check, tests
(vitest) with mocked chain/db. Env: `API_PORT`, `BASE_SEPOLIA_RPC_URL`, `SUPABASE_*`.

Routers (one file each under `src/routes/`), each with list/detail/search as sensible:
`batches`, `checkpoints`, `attestations`, `deals`, `suppliers`, `buyers`, `carriers`,
`organizations`, `kyc`, `reputation`, `bonds`, `invoices` (receivables/NFT), `financing`
(listings/offers), `pools`, `lenders`, `payments`, `treasury`, `insurance`, `claims`,
`disputes`, `governance` (proposals/votes), `nft`, `esg`, `carbon`, `marketplace`,
`auctions`, `rewards`, `referrals`, `analytics` (network overview + time series),
`verdicts`, `notifications`, `search`. Add an `indexer/` with per-contract handlers and a
`schema` extension in infra for the new tables.

## Web — new pages in `@proofchain/web` (`packages/web/src/app/`)

Keep existing supplier/buyer/verifier/deals. ADD (each a real page with data from the API +
on-chain writes via wagmi, loading/empty/error states, zod-validated forms):
`/` (landing/marketing), `/explorer` (+ `/explorer/[batchId]`), `/suppliers` (+ `/suppliers/[address]`),
`/buyers/[address]`, `/carriers`, `/organizations` (+ `/organizations/[id]`), `/leaderboard`,
`/reputation/[address]`, `/dashboard` (analytics), `/finance` (marketplace),
`/finance/pools` (+ `/finance/pools/[id]`), `/finance/lend`, `/invoices/[batchId]`,
`/insurance` (+ `/insurance/claims`), `/disputes` (+ `/disputes/[batchId]`),
`/governance` (+ `/governance/proposals/[id]`), `/nft` (+ `/nft/[tokenId]`), `/esg`,
`/carbon`, `/marketplace` (+ `/marketplace/auctions`), `/rewards`, `/referrals`, `/admin`.
Add a shared `Nav` covering all sections, an `apiClient` (`lib/api.ts` → `NEXT_PUBLIC_API_URL`),
new hooks per domain, and new form/table/card components. Add `NEXT_PUBLIC_API_URL` env.

## Shared additions (`@proofchain/shared`)

Add ABIs for EVERY new contract to `src/abis/`, extend `addresses.ts` `CONTRACTS` map with
all new keys, and add TS types for the new structs/enums (profiles, receivables, policies,
proposals, listings, etc.) in `src/types.ts`. Export from `src/index.ts`.

## Env additions (root `.env.example`)

```
API_PORT=8081
NEXT_PUBLIC_API_URL=http://localhost:8081
GOVERNANCE_TOKEN_ADMIN=
KEEPER_PRIVATE_KEY=
```
