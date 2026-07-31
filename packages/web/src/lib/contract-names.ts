/**
 * Canonical list of every ProofChain platform contract.
 *
 * This is the single source of truth for contract identity in the web app:
 * the ABI registry (`abis.ts`), the address resolver (`shared.ts`), and the
 * `contractRef` helpers (`contracts.ts`) all key off `ALL_CONTRACT_NAMES`.
 *
 * Names match the Solidity contract names and the ABI/JSON filenames exported
 * by `@proofchain/contracts` → `@proofchain/shared` exactly (see SPEC2 modules).
 */

export const ALL_CONTRACT_NAMES = [
  // existing core (do not remove — used by the original supplier/buyer/verifier flows)
  "ProvenanceRegistry",
  "AttestationRegistry",
  "SettlementEscrow",
  "MockUSDC",
  // M0 — core
  "AddressBook",
  "Pauser",
  // M1 — provenance extensions
  "CheckpointOracle",
  "ProvenanceFactory",
  "BatchMetadataStore",
  // M2 — settlement / payments
  "PaymentRouter",
  "StablecoinRegistry",
  "FeeManager",
  "Treasury",
  "EscrowFactory",
  "SettlementRouter",
  // M3 — identity
  "OrganizationRegistry",
  "SupplierRegistry",
  "BuyerRegistry",
  "CarrierRegistry",
  "KYCRegistry",
  "IdentityResolver",
  // M4 — reputation & bonds
  "ReputationEngine",
  "SupplierBond",
  "StakeManager",
  "SlashingController",
  "ScoreOracle",
  // M5 — invoice financing / RWA
  "InvoiceNFT",
  "ReceivableRegistry",
  "InvoiceFinancing",
  "FinancingPool",
  "LenderVault",
  "DiscountCalculator",
  "YieldDistributor",
  "RepaymentController",
  // M6 — insurance
  "InsurancePool",
  "PolicyManager",
  "ClaimsProcessor",
  "PremiumCalculator",
  "RiskPool",
  // M7 — disputes & governance
  "DisputeArbitration",
  "ArbiterStaking",
  "GovernanceToken",
  "ProofChainGovernor",
  "ProofChainTimelock",
  "ProposalRegistry",
  // M8 — tokenization & ESG
  "BatchNFT",
  "WarehouseReceipt",
  "CarbonCreditToken",
  "ESGRegistry",
  "SustainabilityOracle",
  "OffsetMarketplace",
  // M9 — marketplace
  "ListingRegistry",
  "FinancingMarketplace",
  "AuctionHouse",
  "OrderBook",
  "BidManager",
  // M10 — rewards & loyalty
  "LoyaltyPoints",
  "RewardsDistributor",
  "StakingRewards",
  "ReferralProgram",
  "EmissionsController",
] as const;

export type ContractName = (typeof ALL_CONTRACT_NAMES)[number];

const CONTRACT_NAME_SET: ReadonlySet<string> = new Set(ALL_CONTRACT_NAMES);

/** Type guard: is `value` one of the known platform contract names? */
export function isContractName(value: unknown): value is ContractName {
  return typeof value === "string" && CONTRACT_NAME_SET.has(value);
}

/**
 * Legacy lowerCamelCase keys for the four original core contracts, preserved so
 * existing code (`contractAddresses.provenanceRegistry`, etc.) keeps working.
 */
export const LEGACY_ADDRESS_KEYS = {
  ProvenanceRegistry: "provenanceRegistry",
  AttestationRegistry: "attestationRegistry",
  SettlementEscrow: "settlementEscrow",
  MockUSDC: "mockUsdc",
} as const satisfies Partial<Record<ContractName, string>>;
