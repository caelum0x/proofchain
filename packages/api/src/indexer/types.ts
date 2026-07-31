/**
 * Indexer domain types + the contract→group routing table.
 *
 * The indexer scans event logs from every deployed ProofChain contract and
 * dispatches each decoded event to the handler for its MODULE GROUP (M1–M10 from
 * SPEC2). The routing table below is the single source of truth for that
 * mapping; when `@proofchain/shared` gains ABIs for more contracts, adding a row
 * here is all that is needed to index them.
 */
import type { Address, Hex } from 'viem';
import type { ContractName } from '@proofchain/shared';
import type { Db } from '../lib/db.js';
import type { Logger } from '../logger.js';

/**
 * A module/domain group an event is routed to. Kept OPEN (a `string`) rather
 * than a closed union so a Fill agent can introduce a brand-new domain group
 * (`tradefinance`, `dpp`, `logistics`, …) by ADDING a handler file alone — no
 * edit to this union is required. The SPEC2 module groups below are the known,
 * pre-wired values; treat {@link KnownContractGroup} as documentation.
 */
export type ContractGroup = string;

/** The pre-wired SPEC2 module groups (M0–M10). New domains extend this freely. */
export type KnownContractGroup =
  | 'core'
  | 'provenance'
  | 'settlement'
  | 'identity'
  | 'reputation'
  | 'finance'
  | 'insurance'
  | 'governance'
  | 'esg'
  | 'marketplace'
  | 'rewards';

/** A single decoded on-chain event, ready for a handler to persist/project. */
export interface DecodedEvent {
  readonly group: ContractGroup;
  readonly contract: ContractName;
  readonly address: Address;
  readonly eventName: string;
  /** Event args with all bigints converted to strings (JSON-safe). */
  readonly args: Readonly<Record<string, unknown>>;
  readonly blockNumber: bigint;
  readonly transactionHash: Hex;
  readonly logIndex: number;
}

/** Dependencies handed to every handler. */
export interface HandlerDeps {
  readonly db: Db;
  readonly logger: Logger;
}

/**
 * A per-group event handler. `handle` is called once per decoded event whose
 * contract maps to `group`. Handlers are idempotent (upsert on natural keys) so
 * re-processing a block range on restart never duplicates rows.
 *
 * A handler MAY declare the `contracts` it owns; the registry (`handlers/index.ts`)
 * derives the contract→group routing from those declarations, so a Fill agent
 * onboarding a NEW domain does NOT have to touch {@link GROUP_BY_CONTRACT} — the
 * handler file is self-describing. Declarations here take precedence over the
 * static table below.
 */
export interface IndexerHandler {
  readonly group: ContractGroup;
  /** Contract names this handler owns (feeds the derived routing table). */
  readonly contracts?: readonly string[];
  handle(event: DecodedEvent, deps: HandlerDeps): Promise<void>;
}

/**
 * Contract → group routing table. Covers the SPEC2 module contracts so routing
 * is ready the moment their ABIs/addresses are added to `@proofchain/shared`.
 * A contract not listed here falls back to the `core` group.
 */
export const GROUP_BY_CONTRACT: Readonly<Record<string, ContractGroup>> = Object.freeze({
  // M0 core
  AddressBook: 'core',
  Pauser: 'core',
  MockUSDC: 'core',
  AttestationRegistry: 'core',
  // M1 provenance
  ProvenanceRegistry: 'provenance',
  CheckpointOracle: 'provenance',
  ProvenanceFactory: 'provenance',
  BatchMetadataStore: 'provenance',
  // M2 settlement / payments
  SettlementEscrow: 'settlement',
  PaymentRouter: 'settlement',
  StablecoinRegistry: 'settlement',
  FeeManager: 'settlement',
  Treasury: 'settlement',
  EscrowFactory: 'settlement',
  SettlementRouter: 'settlement',
  // M3 identity
  OrganizationRegistry: 'identity',
  SupplierRegistry: 'identity',
  BuyerRegistry: 'identity',
  CarrierRegistry: 'identity',
  KYCRegistry: 'identity',
  IdentityResolver: 'identity',
  // M4 reputation & bonds
  ReputationEngine: 'reputation',
  SupplierBond: 'reputation',
  StakeManager: 'reputation',
  SlashingController: 'reputation',
  ScoreOracle: 'reputation',
  // M5 finance / RWA
  InvoiceNFT: 'finance',
  ReceivableRegistry: 'finance',
  InvoiceFinancing: 'finance',
  FinancingPool: 'finance',
  LenderVault: 'finance',
  DiscountCalculator: 'finance',
  YieldDistributor: 'finance',
  RepaymentController: 'finance',
  // M6 insurance
  InsurancePool: 'insurance',
  PolicyManager: 'insurance',
  ClaimsProcessor: 'insurance',
  PremiumCalculator: 'insurance',
  RiskPool: 'insurance',
  // M7 disputes & governance
  DisputeArbitration: 'governance',
  ArbiterStaking: 'governance',
  GovernanceToken: 'governance',
  ProofChainGovernor: 'governance',
  ProofChainTimelock: 'governance',
  ProposalRegistry: 'governance',
  // M8 tokenization & ESG
  BatchNFT: 'esg',
  WarehouseReceipt: 'esg',
  CarbonCreditToken: 'esg',
  ESGRegistry: 'esg',
  SustainabilityOracle: 'esg',
  OffsetMarketplace: 'esg',
  // M9 marketplace
  ListingRegistry: 'marketplace',
  FinancingMarketplace: 'marketplace',
  AuctionHouse: 'marketplace',
  OrderBook: 'marketplace',
  BidManager: 'marketplace',
  // M10 rewards
  LoyaltyPoints: 'rewards',
  RewardsDistributor: 'rewards',
  StakingRewards: 'rewards',
  ReferralProgram: 'rewards',
  EmissionsController: 'rewards',
});

/** Resolve the group for a contract name, defaulting to `core`. */
export const groupFor = (contract: string): ContractGroup =>
  GROUP_BY_CONTRACT[contract] ?? 'core';
