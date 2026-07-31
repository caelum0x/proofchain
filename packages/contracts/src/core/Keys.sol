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

    // --- Wave A: tradefinance ---
    bytes32 internal constant LETTER_OF_CREDIT = keccak256("LetterOfCredit");
    bytes32 internal constant BILL_OF_EXCHANGE = keccak256("BillOfExchange");
    bytes32 internal constant FACTORING_AGREEMENT = keccak256("FactoringAgreement");
    bytes32 internal constant PURCHASE_ORDER_FINANCING = keccak256("PurchaseOrderFinancing");
    bytes32 internal constant DYNAMIC_DISCOUNTING = keccak256("DynamicDiscounting");
    bytes32 internal constant SUPPLY_CHAIN_FINANCE = keccak256("SupplyChainFinance");
    bytes32 internal constant RECEIVABLE_SECURITIZATION = keccak256("ReceivableSecuritization");
    bytes32 internal constant TRANCHE_TOKEN = keccak256("TrancheToken");
    bytes32 internal constant CREDIT_LINE_MANAGER = keccak256("CreditLineManager");
    bytes32 internal constant GUARANTEE_REGISTRY = keccak256("GuaranteeRegistry");

    // --- Wave A: compliance ---
    bytes32 internal constant SANCTIONS_SCREENING = keccak256("SanctionsScreening");
    bytes32 internal constant AML_REGISTRY = keccak256("AMLRegistry");
    bytes32 internal constant TRADE_COMPLIANCE_ENGINE = keccak256("TradeComplianceEngine");
    bytes32 internal constant CERTIFICATE_OF_ORIGIN = keccak256("CertificateOfOrigin");
    bytes32 internal constant PHYTOSANITARY_CERTIFICATE = keccak256("PhytosanitaryCertificate");
    bytes32 internal constant HALAL_CERTIFICATION = keccak256("HalalCertification");
    bytes32 internal constant PRODUCT_RECALL_REGISTRY = keccak256("ProductRecallRegistry");
    bytes32 internal constant EXPORT_LICENSE_REGISTRY = keccak256("ExportLicenseRegistry");
    bytes32 internal constant DUTY_AND_TARIFF_CALCULATOR = keccak256("DutyAndTariffCalculator");
    bytes32 internal constant CUSTOMS_DECLARATION = keccak256("CustomsDeclaration");

    // --- Wave A: dpp (Digital Product Passport) ---
    bytes32 internal constant DIGITAL_PRODUCT_PASSPORT = keccak256("DigitalProductPassport");
    bytes32 internal constant DPP_LIFECYCLE_REGISTRY = keccak256("DPPLifecycleRegistry");
    bytes32 internal constant MATERIAL_COMPOSITION = keccak256("MaterialComposition");
    bytes32 internal constant REPAIRABILITY_INDEX = keccak256("RepairabilityIndex");
    bytes32 internal constant RECYCLING_REGISTRY = keccak256("RecyclingRegistry");
    bytes32 internal constant DPP_DATA_CARRIER = keccak256("DPPDataCarrier");
    bytes32 internal constant DPP_COMPLIANCE_ORACLE = keccak256("DPPComplianceOracle");

    // --- Wave A: logistics ---
    bytes32 internal constant FREIGHT_BOOKING = keccak256("FreightBooking");
    bytes32 internal constant COLD_CHAIN_MONITOR = keccak256("ColdChainMonitor");
    bytes32 internal constant BONDED_WAREHOUSE = keccak256("BondedWarehouse");
    bytes32 internal constant FLEET_REGISTRY = keccak256("FleetRegistry");
    bytes32 internal constant ROUTE_ATTESTATION = keccak256("RouteAttestation");
    bytes32 internal constant CUSTOMS_BONDED = keccak256("CustomsBonded");
    bytes32 internal constant CONTAINER_REGISTRY = keccak256("ContainerRegistry");
    bytes32 internal constant LAST_MILE_PROOF_OF_DELIVERY = keccak256("LastMileProofOfDelivery");

    // --- Wave A: commodities ---
    bytes32 internal constant COMMODITY_TOKEN = keccak256("CommodityToken");
    bytes32 internal constant HARVEST_REGISTRY = keccak256("HarvestRegistry");
    bytes32 internal constant GRADING_REGISTRY = keccak256("GradingRegistry");
    bytes32 internal constant STORAGE_RECEIPT = keccak256("StorageReceipt");
    bytes32 internal constant PRICE_ORACLE = keccak256("PriceOracle");
    bytes32 internal constant COMMODITY_VAULT = keccak256("CommodityVault");

    // --- Wave A: energy / ESG credits ---
    bytes32 internal constant RENEWABLE_ENERGY_CERTIFICATE = keccak256("RenewableEnergyCertificate");
    bytes32 internal constant EMISSIONS_TRADING = keccak256("EmissionsTrading");
    bytes32 internal constant WATER_CREDIT = keccak256("WaterCredit");
    bytes32 internal constant BIODIVERSITY_CREDIT = keccak256("BiodiversityCredit");
    bytes32 internal constant GREEN_BOND_ISSUER = keccak256("GreenBondIssuer");

    // --- Wave A: workforce ---
    bytes32 internal constant WORKER_CREDENTIAL = keccak256("WorkerCredential");
    bytes32 internal constant SAFETY_TRAINING_REGISTRY = keccak256("SafetyTrainingRegistry");
    bytes32 internal constant MILESTONE_PAYROLL = keccak256("MilestonePayroll");
    bytes32 internal constant SKILL_ATTESTATION = keccak256("SkillAttestation");
    bytes32 internal constant LABOR_COMPLIANCE_REGISTRY = keccak256("LaborComplianceRegistry");

    // --- Wave A: data / oracle ---
    bytes32 internal constant IOT_SENSOR_REGISTRY = keccak256("IoTSensorRegistry");
    bytes32 internal constant QUALITY_INSPECTION = keccak256("QualityInspection");
    bytes32 internal constant LAB_TEST_ATTESTATION = keccak256("LabTestAttestation");
    bytes32 internal constant ORACLE_AGGREGATOR = keccak256("OracleAggregator");
    bytes32 internal constant DATA_MARKETPLACE = keccak256("DataMarketplace");
}
