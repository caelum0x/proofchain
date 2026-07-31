// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Keys
/// @notice Canonical `bytes32` AddressBook keys for every ProofChain contract. Modules resolve
///         peers via `_addr(Keys.X)` so wiring lives in one place and stays consistent at scale.
/// @dev Each key is `keccak256(<ContractName>)`. Add new modules here, never inline literals.
library Keys {
    // --- existing root contracts ---
    bytes32 internal constant PROVENANCE_REGISTRY = keccak256("ProvenanceRegistry");
    bytes32 internal constant ATTESTATION_REGISTRY = keccak256("AttestationRegistry");
    bytes32 internal constant SETTLEMENT_ESCROW = keccak256("SettlementEscrow");
    bytes32 internal constant MOCK_USDC = keccak256("MockUSDC");

    // --- M0 core ---
    bytes32 internal constant PAUSER = keccak256("Pauser");

    // --- M1 provenance extensions ---
    bytes32 internal constant CHECKPOINT_ORACLE = keccak256("CheckpointOracle");
    bytes32 internal constant PROVENANCE_FACTORY = keccak256("ProvenanceFactory");
    bytes32 internal constant BATCH_METADATA_STORE = keccak256("BatchMetadataStore");

    // --- M2 payments / settlement extensions ---
    bytes32 internal constant PAYMENT_ROUTER = keccak256("PaymentRouter");
    bytes32 internal constant STABLECOIN_REGISTRY = keccak256("StablecoinRegistry");
    bytes32 internal constant FEE_MANAGER = keccak256("FeeManager");
    bytes32 internal constant TREASURY = keccak256("Treasury");
    bytes32 internal constant ESCROW_FACTORY = keccak256("EscrowFactory");
    bytes32 internal constant SETTLEMENT_ROUTER = keccak256("SettlementRouter");

    // --- M3 identity ---
    bytes32 internal constant ORGANIZATION_REGISTRY = keccak256("OrganizationRegistry");
    bytes32 internal constant SUPPLIER_REGISTRY = keccak256("SupplierRegistry");
    bytes32 internal constant BUYER_REGISTRY = keccak256("BuyerRegistry");
    bytes32 internal constant CARRIER_REGISTRY = keccak256("CarrierRegistry");
    bytes32 internal constant KYC_REGISTRY = keccak256("KYCRegistry");
    bytes32 internal constant IDENTITY_RESOLVER = keccak256("IdentityResolver");

    // --- M4 reputation & bonds ---
    bytes32 internal constant REPUTATION_ENGINE = keccak256("ReputationEngine");
    bytes32 internal constant SUPPLIER_BOND = keccak256("SupplierBond");
    bytes32 internal constant STAKE_MANAGER = keccak256("StakeManager");
    bytes32 internal constant SLASHING_CONTROLLER = keccak256("SlashingController");
    bytes32 internal constant SCORE_ORACLE = keccak256("ScoreOracle");

    // --- M5 invoice financing / RWA ---
    bytes32 internal constant INVOICE_NFT = keccak256("InvoiceNFT");
    bytes32 internal constant RECEIVABLE_REGISTRY = keccak256("ReceivableRegistry");
    bytes32 internal constant INVOICE_FINANCING = keccak256("InvoiceFinancing");
    bytes32 internal constant FINANCING_POOL = keccak256("FinancingPool");
    bytes32 internal constant LENDER_VAULT = keccak256("LenderVault");
    bytes32 internal constant DISCOUNT_CALCULATOR = keccak256("DiscountCalculator");
    bytes32 internal constant YIELD_DISTRIBUTOR = keccak256("YieldDistributor");
    bytes32 internal constant REPAYMENT_CONTROLLER = keccak256("RepaymentController");

    // --- M6 insurance ---
    bytes32 internal constant INSURANCE_POOL = keccak256("InsurancePool");
    bytes32 internal constant POLICY_MANAGER = keccak256("PolicyManager");
    bytes32 internal constant CLAIMS_PROCESSOR = keccak256("ClaimsProcessor");
    bytes32 internal constant PREMIUM_CALCULATOR = keccak256("PremiumCalculator");
    bytes32 internal constant RISK_POOL = keccak256("RiskPool");

    // --- M7 disputes & governance ---
    bytes32 internal constant DISPUTE_ARBITRATION = keccak256("DisputeArbitration");
    bytes32 internal constant ARBITER_STAKING = keccak256("ArbiterStaking");
    bytes32 internal constant GOVERNANCE_TOKEN = keccak256("GovernanceToken");
    bytes32 internal constant PROOFCHAIN_GOVERNOR = keccak256("ProofChainGovernor");
    bytes32 internal constant PROOFCHAIN_TIMELOCK = keccak256("ProofChainTimelock");
    bytes32 internal constant PROPOSAL_REGISTRY = keccak256("ProposalRegistry");

    // --- M8 tokenization & ESG ---
    bytes32 internal constant BATCH_NFT = keccak256("BatchNFT");
    bytes32 internal constant WAREHOUSE_RECEIPT = keccak256("WarehouseReceipt");
    bytes32 internal constant CARBON_CREDIT_TOKEN = keccak256("CarbonCreditToken");
    bytes32 internal constant ESG_REGISTRY = keccak256("ESGRegistry");
    bytes32 internal constant SUSTAINABILITY_ORACLE = keccak256("SustainabilityOracle");
    bytes32 internal constant OFFSET_MARKETPLACE = keccak256("OffsetMarketplace");

    // --- M9 marketplace ---
    bytes32 internal constant LISTING_REGISTRY = keccak256("ListingRegistry");
    bytes32 internal constant FINANCING_MARKETPLACE = keccak256("FinancingMarketplace");
    bytes32 internal constant AUCTION_HOUSE = keccak256("AuctionHouse");
    bytes32 internal constant ORDER_BOOK = keccak256("OrderBook");
    bytes32 internal constant BID_MANAGER = keccak256("BidManager");

    // --- M10 rewards & loyalty ---
    bytes32 internal constant LOYALTY_POINTS = keccak256("LoyaltyPoints");
    bytes32 internal constant REWARDS_DISTRIBUTOR = keccak256("RewardsDistributor");
    bytes32 internal constant STAKING_REWARDS = keccak256("StakingRewards");
    bytes32 internal constant REFERRAL_PROGRAM = keccak256("ReferralProgram");
    bytes32 internal constant EMISSIONS_CONTROLLER = keccak256("EmissionsController");
}
