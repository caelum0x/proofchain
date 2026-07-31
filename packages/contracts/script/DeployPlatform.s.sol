// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

import { Keys } from "../src/core/Keys.sol";
import { Roles } from "../src/core/Roles.sol";

// Root
import { ProvenanceRegistry } from "../src/ProvenanceRegistry.sol";
import { AttestationRegistry } from "../src/AttestationRegistry.sol";
import { SettlementEscrow } from "../src/SettlementEscrow.sol";
import { MockUSDC } from "../src/MockUSDC.sol";

// M0 core
import { AddressBook } from "../src/core/AddressBook.sol";
import { Pauser } from "../src/core/Pauser.sol";

// M1 provenance
import { CheckpointOracle } from "../src/provenance/CheckpointOracle.sol";
import { ProvenanceFactory } from "../src/provenance/ProvenanceFactory.sol";
import { BatchMetadataStore } from "../src/provenance/BatchMetadataStore.sol";

// M2 payments
import { StablecoinRegistry } from "../src/payments/StablecoinRegistry.sol";
import { FeeManager } from "../src/payments/FeeManager.sol";
import { Treasury } from "../src/payments/Treasury.sol";
import { PaymentRouter } from "../src/payments/PaymentRouter.sol";
import { EscrowFactory } from "../src/payments/EscrowFactory.sol";
import { SettlementRouter } from "../src/payments/SettlementRouter.sol";

// M3 identity
import { OrganizationRegistry } from "../src/identity/OrganizationRegistry.sol";
import { SupplierRegistry } from "../src/identity/SupplierRegistry.sol";
import { BuyerRegistry } from "../src/identity/BuyerRegistry.sol";
import { CarrierRegistry } from "../src/identity/CarrierRegistry.sol";
import { KYCRegistry } from "../src/identity/KYCRegistry.sol";
import { IdentityResolver } from "../src/identity/IdentityResolver.sol";

// M4 reputation
import { ReputationEngine } from "../src/reputation/ReputationEngine.sol";
import { SupplierBond } from "../src/reputation/SupplierBond.sol";
import { StakeManager } from "../src/reputation/StakeManager.sol";
import { SlashingController } from "../src/reputation/SlashingController.sol";
import { ScoreOracle } from "../src/reputation/ScoreOracle.sol";

// M5 finance
import { InvoiceNFT } from "../src/finance/InvoiceNFT.sol";
import { ReceivableRegistry } from "../src/finance/ReceivableRegistry.sol";
import { InvoiceFinancing } from "../src/finance/InvoiceFinancing.sol";
import { FinancingPool } from "../src/finance/FinancingPool.sol";
import { LenderVault } from "../src/finance/LenderVault.sol";
import { DiscountCalculator } from "../src/finance/DiscountCalculator.sol";
import { YieldDistributor } from "../src/finance/YieldDistributor.sol";
import { RepaymentController } from "../src/finance/RepaymentController.sol";

// M6 insurance
import { InsurancePool } from "../src/insurance/InsurancePool.sol";
import { PolicyManager } from "../src/insurance/PolicyManager.sol";
import { ClaimsProcessor } from "../src/insurance/ClaimsProcessor.sol";
import { PremiumCalculator } from "../src/insurance/PremiumCalculator.sol";
import { RiskPool } from "../src/insurance/RiskPool.sol";

// M7 governance
import { DisputeArbitration } from "../src/governance/DisputeArbitration.sol";
import { ArbiterStaking } from "../src/governance/ArbiterStaking.sol";
import { GovernanceToken } from "../src/governance/GovernanceToken.sol";
import { ProofChainGovernor } from "../src/governance/ProofChainGovernor.sol";
import { ProofChainTimelock } from "../src/governance/ProofChainTimelock.sol";
import { ProposalRegistry } from "../src/governance/ProposalRegistry.sol";

// M8 ESG
import { BatchNFT } from "../src/esg/BatchNFT.sol";
import { WarehouseReceipt } from "../src/esg/WarehouseReceipt.sol";
import { CarbonCreditToken } from "../src/esg/CarbonCreditToken.sol";
import { ESGRegistry } from "../src/esg/ESGRegistry.sol";
import { SustainabilityOracle } from "../src/esg/SustainabilityOracle.sol";
import { OffsetMarketplace } from "../src/esg/OffsetMarketplace.sol";

// M9 marketplace
import { ListingRegistry } from "../src/marketplace/ListingRegistry.sol";
import { FinancingMarketplace } from "../src/marketplace/FinancingMarketplace.sol";
import { AuctionHouse } from "../src/marketplace/AuctionHouse.sol";
import { OrderBook } from "../src/marketplace/OrderBook.sol";
import { BidManager } from "../src/marketplace/BidManager.sol";

// M10 rewards
import { LoyaltyPoints } from "../src/rewards/LoyaltyPoints.sol";
import { RewardsDistributor } from "../src/rewards/RewardsDistributor.sol";
import { StakingRewards } from "../src/rewards/StakingRewards.sol";
import { ReferralProgram } from "../src/rewards/ReferralProgram.sol";
import { EmissionsController } from "../src/rewards/EmissionsController.sol";

// Wave A: tradefinance
import { LetterOfCredit } from "../src/tradefinance/LetterOfCredit.sol";
import { BillOfExchange } from "../src/tradefinance/BillOfExchange.sol";
import { FactoringAgreement } from "../src/tradefinance/FactoringAgreement.sol";
import { PurchaseOrderFinancing } from "../src/tradefinance/PurchaseOrderFinancing.sol";
import { DynamicDiscounting } from "../src/tradefinance/DynamicDiscounting.sol";
import { SupplyChainFinance } from "../src/tradefinance/SupplyChainFinance.sol";
import { ReceivableSecuritization } from "../src/tradefinance/ReceivableSecuritization.sol";
import { TrancheToken } from "../src/tradefinance/TrancheToken.sol";
import { CreditLineManager } from "../src/tradefinance/CreditLineManager.sol";
import { GuaranteeRegistry } from "../src/tradefinance/GuaranteeRegistry.sol";

// Wave A: compliance
import { SanctionsScreening } from "../src/compliance/SanctionsScreening.sol";
import { AMLRegistry } from "../src/compliance/AMLRegistry.sol";
import { TradeComplianceEngine } from "../src/compliance/TradeComplianceEngine.sol";
import { CertificateOfOrigin } from "../src/compliance/CertificateOfOrigin.sol";
import { PhytosanitaryCertificate } from "../src/compliance/PhytosanitaryCertificate.sol";
import { HalalCertification } from "../src/compliance/HalalCertification.sol";
import { ProductRecallRegistry } from "../src/compliance/ProductRecallRegistry.sol";
import { ExportLicenseRegistry } from "../src/compliance/ExportLicenseRegistry.sol";
import { DutyAndTariffCalculator } from "../src/compliance/DutyAndTariffCalculator.sol";
import { CustomsDeclaration } from "../src/compliance/CustomsDeclaration.sol";

// Wave A: dpp
import { DigitalProductPassport } from "../src/dpp/DigitalProductPassport.sol";
import { DPPLifecycleRegistry } from "../src/dpp/DPPLifecycleRegistry.sol";
import { MaterialComposition } from "../src/dpp/MaterialComposition.sol";
import { RepairabilityIndex } from "../src/dpp/RepairabilityIndex.sol";
import { RecyclingRegistry } from "../src/dpp/RecyclingRegistry.sol";
import { DPPDataCarrier } from "../src/dpp/DPPDataCarrier.sol";
import { DPPComplianceOracle } from "../src/dpp/DPPComplianceOracle.sol";

// Wave A: logistics
import { FreightBooking } from "../src/logistics/FreightBooking.sol";
import { ColdChainMonitor } from "../src/logistics/ColdChainMonitor.sol";
import { BondedWarehouse } from "../src/logistics/BondedWarehouse.sol";
import { FleetRegistry } from "../src/logistics/FleetRegistry.sol";
import { RouteAttestation } from "../src/logistics/RouteAttestation.sol";
import { CustomsBonded } from "../src/logistics/CustomsBonded.sol";
import { ContainerRegistry } from "../src/logistics/ContainerRegistry.sol";
import { LastMileProofOfDelivery } from "../src/logistics/LastMileProofOfDelivery.sol";

// Wave A: commodities
import { CommodityToken } from "../src/commodities/CommodityToken.sol";
import { CommodityVault } from "../src/commodities/CommodityVault.sol";
import { HarvestRegistry } from "../src/commodities/HarvestRegistry.sol";
import { GradingRegistry } from "../src/commodities/GradingRegistry.sol";
import { StorageReceipt } from "../src/commodities/StorageReceipt.sol";
import { PriceOracle } from "../src/commodities/PriceOracle.sol";

// Wave A: energy
import { RenewableEnergyCertificate } from "../src/energy/RenewableEnergyCertificate.sol";
import { EmissionsTrading } from "../src/energy/EmissionsTrading.sol";
import { WaterCredit } from "../src/energy/WaterCredit.sol";
import { BiodiversityCredit } from "../src/energy/BiodiversityCredit.sol";
import { GreenBondIssuer } from "../src/energy/GreenBondIssuer.sol";

// Wave A: workforce
import { WorkerCredential } from "../src/workforce/WorkerCredential.sol";
import { SafetyTrainingRegistry } from "../src/workforce/SafetyTrainingRegistry.sol";
import { MilestonePayroll } from "../src/workforce/MilestonePayroll.sol";
import { SkillAttestation } from "../src/workforce/SkillAttestation.sol";
import { LaborComplianceRegistry } from "../src/workforce/LaborComplianceRegistry.sol";

// Wave A: data
import { IoTSensorRegistry } from "../src/data/IoTSensorRegistry.sol";
import { QualityInspection } from "../src/data/QualityInspection.sol";
import { LabTestAttestation } from "../src/data/LabTestAttestation.sol";
import { OracleAggregator } from "../src/data/OracleAggregator.sol";
import { DataMarketplace } from "../src/data/DataMarketplace.sol";

/// @title DeployPlatform
/// @notice Full-platform deployment: deploys the AddressBook, every module contract (~60), registers
///         all of them in the AddressBook, wires cross-module roles per SPEC2, and writes ALL
///         addresses to `deployments/base-sepolia.json`.
/// @dev Addresses are stored straight into the AddressBook as contracts are deployed (rather than
///      kept as ~60 stack locals) both to keep wiring in one place and to avoid stack-too-deep. Env:
///      DEPLOYER_PRIVATE_KEY (required), AGENT_ADDRESS (required), KEEPER_ADDRESS (optional, defaults
///      to the agent). The deployer is DEFAULT_ADMIN of every module.
contract DeployPlatform is Script {
    // Timelock role ids (mirror OZ TimelockController constants).
    bytes32 internal constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 internal constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 internal constant CANCELLER_ROLE = keccak256("CANCELLER_ROLE");

    AddressBook internal book;
    address internal deployer;
    address internal agent;
    address internal keeper;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        agent = vm.envAddress("AGENT_ADDRESS");
        require(agent != address(0), "AGENT_ADDRESS must be set");
        keeper = vm.envOr("KEEPER_ADDRESS", agent);
        deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        book = new AddressBook(deployer);

        _deployRootAndCore();
        _deployProvenance();
        _deployPayments();
        _deployIdentity();
        _deployReputation();
        _deployFinance();
        _deployInsurance();
        _deployGovernance();
        _deployEsg();
        _deployMarketplace();
        _deployRewards();

        // Wave A: real-world trade domains.
        _deployTradeFinance();
        _deployCompliance();
        _deployDpp();
        _deployLogistics();
        _deployCommodities();
        _deployEnergy();
        _deployWorkforce();
        _deployData();

        _wireRoles();

        vm.stopBroadcast();

        _writeDeployments();
        console2.log("AddressBook:", address(book));
        console2.log("Platform deployed. Addresses written to deployments/base-sepolia.json");
    }

    // ------------------------------------------------------------------ helpers

    function _reg(bytes32 key, address addr) internal {
        book.setAddress(key, addr);
    }

    function _at(bytes32 key) internal view returns (address) {
        return book.getAddress(key);
    }

    /// @dev Grant `role` on the module registered at `key` to `grantee` (deployer is DEFAULT_ADMIN).
    function _grant(bytes32 key, bytes32 role, address grantee) internal {
        AccessControl(_at(key)).grantRole(role, grantee);
    }

    // ------------------------------------------------------------------ deploys

    function _deployRootAndCore() internal {
        address prov = address(new ProvenanceRegistry(deployer));
        _reg(Keys.PROVENANCE_REGISTRY, prov);
        _reg(Keys.ATTESTATION_REGISTRY, address(new AttestationRegistry(deployer, prov)));
        _reg(
            Keys.SETTLEMENT_ESCROW,
            address(new SettlementEscrow(deployer, _at(Keys.ATTESTATION_REGISTRY), prov))
        );
        _reg(Keys.MOCK_USDC, address(new MockUSDC()));
        _reg(Keys.PAUSER, address(new Pauser(deployer)));
    }

    function _deployProvenance() internal {
        _reg(Keys.CHECKPOINT_ORACLE, address(new CheckpointOracle(address(book), deployer)));
        _reg(Keys.PROVENANCE_FACTORY, address(new ProvenanceFactory(address(book), deployer)));
        _reg(Keys.BATCH_METADATA_STORE, address(new BatchMetadataStore(address(book), deployer)));
    }

    function _deployPayments() internal {
        _reg(Keys.STABLECOIN_REGISTRY, address(new StablecoinRegistry(address(book), deployer)));
        _reg(Keys.FEE_MANAGER, address(new FeeManager(address(book), deployer)));
        _reg(Keys.TREASURY, address(new Treasury(address(book), deployer)));
        _reg(Keys.PAYMENT_ROUTER, address(new PaymentRouter(address(book), deployer)));
        _reg(Keys.ESCROW_FACTORY, address(new EscrowFactory(address(book), deployer)));
        _reg(Keys.SETTLEMENT_ROUTER, address(new SettlementRouter(address(book), deployer)));
        // Accept the platform's USDC as a settlement token (6 decimals).
        StablecoinRegistry(_at(Keys.STABLECOIN_REGISTRY)).addToken(_at(Keys.MOCK_USDC), 6);
    }

    function _deployIdentity() internal {
        _reg(Keys.ORGANIZATION_REGISTRY, address(new OrganizationRegistry(address(book), deployer)));
        _reg(Keys.SUPPLIER_REGISTRY, address(new SupplierRegistry(address(book), deployer)));
        _reg(Keys.BUYER_REGISTRY, address(new BuyerRegistry(address(book), deployer)));
        _reg(Keys.CARRIER_REGISTRY, address(new CarrierRegistry(address(book), deployer)));
        _reg(Keys.KYC_REGISTRY, address(new KYCRegistry(address(book), deployer)));
        _reg(Keys.IDENTITY_RESOLVER, address(new IdentityResolver(address(book), deployer)));
    }

    function _deployReputation() internal {
        _reg(Keys.REPUTATION_ENGINE, address(new ReputationEngine(address(book), deployer)));
        _reg(Keys.SUPPLIER_BOND, address(new SupplierBond(address(book), deployer)));
        _reg(Keys.STAKE_MANAGER, address(new StakeManager(address(book), deployer)));
        _reg(Keys.SLASHING_CONTROLLER, address(new SlashingController(address(book), deployer)));
        _reg(Keys.SCORE_ORACLE, address(new ScoreOracle(address(book), deployer)));
    }

    function _deployFinance() internal {
        _reg(Keys.INVOICE_NFT, address(new InvoiceNFT(address(book), deployer)));
        _reg(Keys.RECEIVABLE_REGISTRY, address(new ReceivableRegistry(address(book), deployer)));
        _reg(Keys.INVOICE_FINANCING, address(new InvoiceFinancing(address(book), deployer)));
        _reg(Keys.FINANCING_POOL, address(new FinancingPool(address(book), deployer, 7)));
        _reg(Keys.LENDER_VAULT, address(new LenderVault(address(book), deployer, _at(Keys.MOCK_USDC))));
        _reg(Keys.DISCOUNT_CALCULATOR, address(new DiscountCalculator(address(book), deployer)));
        _reg(Keys.YIELD_DISTRIBUTOR, address(new YieldDistributor(address(book), deployer)));
        _reg(Keys.REPAYMENT_CONTROLLER, address(new RepaymentController(address(book), deployer)));
    }

    function _deployInsurance() internal {
        _reg(Keys.INSURANCE_POOL, address(new InsurancePool(address(book), deployer)));
        _reg(Keys.POLICY_MANAGER, address(new PolicyManager(address(book), deployer)));
        _reg(Keys.CLAIMS_PROCESSOR, address(new ClaimsProcessor(address(book), deployer)));
        _reg(Keys.PREMIUM_CALCULATOR, address(new PremiumCalculator(address(book), deployer)));
        _reg(Keys.RISK_POOL, address(new RiskPool(address(book), deployer)));
    }

    function _deployGovernance() internal {
        _reg(Keys.GOVERNANCE_TOKEN, address(new GovernanceToken(deployer, deployer)));

        address[] memory proposers = new address[](0);
        address[] memory executors = new address[](1);
        executors[0] = address(0); // open execution
        _reg(Keys.PROOFCHAIN_TIMELOCK, address(new ProofChainTimelock(2 days, proposers, executors, deployer)));

        // Governor resolves the token + timelock from the AddressBook in its constructor, so both
        // must already be registered above.
        _reg(
            Keys.PROOFCHAIN_GOVERNOR,
            address(new ProofChainGovernor(address(book), uint48(1), uint32(50_400), 0, 4))
        );
        _reg(Keys.PROPOSAL_REGISTRY, address(new ProposalRegistry()));
        _reg(Keys.ARBITER_STAKING, address(new ArbiterStaking(address(book), deployer, 1_000e6)));
        _reg(
            Keys.DISPUTE_ARBITRATION,
            address(new DisputeArbitration(address(book), deployer, uint64(3 days), 0))
        );
    }

    function _deployEsg() internal {
        _reg(Keys.BATCH_NFT, address(new BatchNFT(address(book), deployer)));
        _reg(Keys.WAREHOUSE_RECEIPT, address(new WarehouseReceipt(address(book), deployer)));
        _reg(
            Keys.CARBON_CREDIT_TOKEN,
            address(new CarbonCreditToken(address(book), deployer, "https://proofchain.example/carbon/{id}.json"))
        );
        _reg(Keys.ESG_REGISTRY, address(new ESGRegistry(address(book), deployer)));
        _reg(Keys.SUSTAINABILITY_ORACLE, address(new SustainabilityOracle(address(book), deployer)));
        _reg(Keys.OFFSET_MARKETPLACE, address(new OffsetMarketplace(address(book), deployer)));
    }

    function _deployMarketplace() internal {
        _reg(Keys.LISTING_REGISTRY, address(new ListingRegistry(address(book), deployer)));
        _reg(Keys.FINANCING_MARKETPLACE, address(new FinancingMarketplace(address(book), deployer)));
        _reg(Keys.AUCTION_HOUSE, address(new AuctionHouse(address(book), deployer)));
        _reg(Keys.ORDER_BOOK, address(new OrderBook(address(book), deployer)));
        _reg(Keys.BID_MANAGER, address(new BidManager(address(book), deployer)));
    }

    function _deployRewards() internal {
        _reg(Keys.LOYALTY_POINTS, address(new LoyaltyPoints(deployer, deployer, false)));
        _reg(Keys.REWARDS_DISTRIBUTOR, address(new RewardsDistributor(address(book), deployer)));
        _reg(Keys.REFERRAL_PROGRAM, address(new ReferralProgram(address(book), deployer, 500)));
        // EmissionsController must precede StakingRewards: the latter reads its rate at construction.
        _reg(Keys.EMISSIONS_CONTROLLER, address(new EmissionsController(address(book), deployer, deployer)));
        _reg(
            Keys.STAKING_REWARDS,
            address(new StakingRewards(address(book), deployer, _at(Keys.GOVERNANCE_TOKEN)))
        );
    }

    // ------------------------------------------------------------------ Wave A deploys

    function _deployTradeFinance() internal {
        _reg(Keys.LETTER_OF_CREDIT, address(new LetterOfCredit(address(book), deployer)));
        _reg(Keys.BILL_OF_EXCHANGE, address(new BillOfExchange(address(book), deployer)));
        _reg(Keys.FACTORING_AGREEMENT, address(new FactoringAgreement(address(book), deployer)));
        _reg(Keys.PURCHASE_ORDER_FINANCING, address(new PurchaseOrderFinancing(address(book), deployer)));
        _reg(Keys.DYNAMIC_DISCOUNTING, address(new DynamicDiscounting(address(book), deployer)));
        _reg(Keys.SUPPLY_CHAIN_FINANCE, address(new SupplyChainFinance(address(book), deployer)));
        _reg(Keys.RECEIVABLE_SECURITIZATION, address(new ReceivableSecuritization(address(book), deployer)));
        // Template tranche token; the securitization module mints per-pool tranches at runtime.
        _reg(
            Keys.TRANCHE_TOKEN,
            address(new TrancheToken("ProofChain Tranche", "PCT", bytes32(0), 0, deployer, _at(Keys.RECEIVABLE_SECURITIZATION)))
        );
        _reg(Keys.CREDIT_LINE_MANAGER, address(new CreditLineManager(address(book), deployer)));
        _reg(Keys.GUARANTEE_REGISTRY, address(new GuaranteeRegistry(address(book), deployer)));
    }

    function _deployCompliance() internal {
        _reg(Keys.SANCTIONS_SCREENING, address(new SanctionsScreening(address(book), deployer)));
        _reg(Keys.AML_REGISTRY, address(new AMLRegistry(address(book), deployer)));
        _reg(Keys.TRADE_COMPLIANCE_ENGINE, address(new TradeComplianceEngine(address(book), deployer)));
        _reg(Keys.CERTIFICATE_OF_ORIGIN, address(new CertificateOfOrigin(address(book), deployer)));
        _reg(Keys.PHYTOSANITARY_CERTIFICATE, address(new PhytosanitaryCertificate(address(book), deployer)));
        _reg(Keys.HALAL_CERTIFICATION, address(new HalalCertification(address(book), deployer)));
        _reg(Keys.PRODUCT_RECALL_REGISTRY, address(new ProductRecallRegistry(address(book), deployer)));
        _reg(Keys.EXPORT_LICENSE_REGISTRY, address(new ExportLicenseRegistry(address(book), deployer)));
        _reg(Keys.DUTY_AND_TARIFF_CALCULATOR, address(new DutyAndTariffCalculator(address(book), deployer)));
        _reg(Keys.CUSTOMS_DECLARATION, address(new CustomsDeclaration(address(book), deployer)));
    }

    function _deployDpp() internal {
        _reg(Keys.DIGITAL_PRODUCT_PASSPORT, address(new DigitalProductPassport(address(book), deployer)));
        _reg(Keys.DPP_LIFECYCLE_REGISTRY, address(new DPPLifecycleRegistry(address(book), deployer)));
        _reg(Keys.MATERIAL_COMPOSITION, address(new MaterialComposition(address(book), deployer)));
        _reg(Keys.REPAIRABILITY_INDEX, address(new RepairabilityIndex(address(book), deployer)));
        _reg(Keys.RECYCLING_REGISTRY, address(new RecyclingRegistry(address(book), deployer)));
        _reg(Keys.DPP_DATA_CARRIER, address(new DPPDataCarrier(address(book), deployer)));
        _reg(Keys.DPP_COMPLIANCE_ORACLE, address(new DPPComplianceOracle(address(book), deployer)));
    }

    function _deployLogistics() internal {
        _reg(Keys.FREIGHT_BOOKING, address(new FreightBooking(address(book), deployer)));
        _reg(Keys.COLD_CHAIN_MONITOR, address(new ColdChainMonitor(address(book), deployer)));
        _reg(Keys.BONDED_WAREHOUSE, address(new BondedWarehouse(address(book), deployer)));
        _reg(Keys.FLEET_REGISTRY, address(new FleetRegistry(address(book), deployer)));
        _reg(Keys.ROUTE_ATTESTATION, address(new RouteAttestation(address(book), deployer)));
        _reg(Keys.CUSTOMS_BONDED, address(new CustomsBonded(address(book), deployer)));
        _reg(Keys.CONTAINER_REGISTRY, address(new ContainerRegistry(address(book), deployer)));
        _reg(Keys.LAST_MILE_PROOF_OF_DELIVERY, address(new LastMileProofOfDelivery(address(book), deployer)));
    }

    function _deployCommodities() internal {
        _reg(Keys.COMMODITY_VAULT, address(new CommodityVault(address(book), deployer)));
        // The vault is the sole minter/burner of the commodity token (resolved via the AddressBook).
        _reg(
            Keys.COMMODITY_TOKEN,
            address(new CommodityToken(address(book), deployer, "ProofChain Commodity", "PCCOM", bytes32("GENERIC"), bytes32("A")))
        );
        _reg(Keys.HARVEST_REGISTRY, address(new HarvestRegistry(address(book), deployer)));
        _reg(Keys.GRADING_REGISTRY, address(new GradingRegistry(address(book), deployer)));
        _reg(Keys.STORAGE_RECEIPT, address(new StorageReceipt(address(book), deployer)));
        _reg(Keys.PRICE_ORACLE, address(new PriceOracle(address(book), deployer)));
    }

    function _deployEnergy() internal {
        _reg(
            Keys.RENEWABLE_ENERGY_CERTIFICATE,
            address(new RenewableEnergyCertificate(address(book), deployer, "https://proofchain.example/rec/{id}.json"))
        );
        _reg(Keys.EMISSIONS_TRADING, address(new EmissionsTrading(address(book), deployer)));
        _reg(Keys.WATER_CREDIT, address(new WaterCredit(address(book), deployer)));
        _reg(Keys.BIODIVERSITY_CREDIT, address(new BiodiversityCredit(address(book), deployer)));
        _reg(Keys.GREEN_BOND_ISSUER, address(new GreenBondIssuer(address(book), deployer)));
    }

    function _deployWorkforce() internal {
        _reg(Keys.WORKER_CREDENTIAL, address(new WorkerCredential(address(book), deployer)));
        _reg(Keys.SAFETY_TRAINING_REGISTRY, address(new SafetyTrainingRegistry(address(book), deployer)));
        _reg(Keys.MILESTONE_PAYROLL, address(new MilestonePayroll(address(book), deployer)));
        _reg(Keys.SKILL_ATTESTATION, address(new SkillAttestation(address(book), deployer)));
        _reg(Keys.LABOR_COMPLIANCE_REGISTRY, address(new LaborComplianceRegistry(address(book), deployer)));
    }

    function _deployData() internal {
        _reg(Keys.IOT_SENSOR_REGISTRY, address(new IoTSensorRegistry(address(book), deployer)));
        _reg(Keys.QUALITY_INSPECTION, address(new QualityInspection(address(book), deployer)));
        _reg(Keys.LAB_TEST_ATTESTATION, address(new LabTestAttestation(address(book), deployer)));
        _reg(Keys.ORACLE_AGGREGATOR, address(new OracleAggregator(address(book), deployer)));
        _reg(Keys.DATA_MARKETPLACE, address(new DataMarketplace(address(book), deployer)));
    }

    // ------------------------------------------------------------------ wiring

    function _wireRoles() internal {
        bytes32 stakeControllerRole = keccak256("STAKE_CONTROLLER_ROLE");
        bytes32 bondLockerRole = keccak256("BOND_LOCKER_ROLE");
        bytes32 marketRole = keccak256("MARKET_ROLE");
        bytes32 conversionRecorderRole = keccak256("CONVERSION_RECORDER_ROLE");

        // Verification agent may attest.
        _grant(Keys.ATTESTATION_REGISTRY, Roles.AGENT_ROLE, agent);

        // Oracles / factory register batches & checkpoints in the ground-truth registry.
        _grant(Keys.PROVENANCE_REGISTRY, Roles.REGISTRAR_ROLE, _at(Keys.CHECKPOINT_ORACLE));
        _grant(Keys.PROVENANCE_REGISTRY, Roles.REGISTRAR_ROLE, _at(Keys.PROVENANCE_FACTORY));

        // Trusted keepers push IoT / emissions feeds.
        _grant(Keys.CHECKPOINT_ORACLE, Roles.KEEPER_ROLE, keeper);
        _grant(Keys.SUSTAINABILITY_ORACLE, Roles.KEEPER_ROLE, keeper);

        // Settlement outcomes feed reputation (escrow + orchestrating router).
        _grant(Keys.REPUTATION_ENGINE, Roles.REPUTATION_UPDATER_ROLE, _at(Keys.SETTLEMENT_ESCROW));
        _grant(Keys.REPUTATION_ENGINE, Roles.REPUTATION_UPDATER_ROLE, _at(Keys.SETTLEMENT_ROUTER));

        // Arbitration can arbiter-release disputed escrow deals.
        _grant(Keys.SETTLEMENT_ESCROW, Roles.ARBITER_ROLE, _at(Keys.DISPUTE_ARBITRATION));

        // Bonds/stakes: escrow can lock supplier bonds; arbitration/stakemgr slashing.
        _grant(Keys.SUPPLIER_BOND, bondLockerRole, _at(Keys.SETTLEMENT_ESCROW));
        _grant(Keys.STAKE_MANAGER, stakeControllerRole, _at(Keys.ARBITER_STAKING));
        _grant(Keys.STAKE_MANAGER, Roles.SLASHER_ROLE, _at(Keys.SLASHING_CONTROLLER));
        _grant(Keys.SLASHING_CONTROLLER, Roles.SLASHER_ROLE, _at(Keys.DISPUTE_ARBITRATION));

        // Financing mints the receivable NFT on funding.
        _grant(Keys.INVOICE_NFT, Roles.MINTER_ROLE, _at(Keys.INVOICE_FINANCING));

        // Marketplaces flip listings to Filled once they settle a trade.
        _grant(Keys.LISTING_REGISTRY, marketRole, _at(Keys.AUCTION_HOUSE));
        _grant(Keys.LISTING_REGISTRY, marketRole, _at(Keys.ORDER_BOOK));
        _grant(Keys.LISTING_REGISTRY, marketRole, _at(Keys.FINANCING_MARKETPLACE));
        // AuctionHouse escrows bids through the BidManager.
        _grant(Keys.BID_MANAGER, marketRole, _at(Keys.AUCTION_HOUSE));

        // Rewards emission attribution.
        _grant(Keys.REFERRAL_PROGRAM, conversionRecorderRole, _at(Keys.SETTLEMENT_ROUTER));

        // Governance: the Governor proposes/cancels through the Timelock; execution is open.
        _grant(Keys.PROOFCHAIN_TIMELOCK, PROPOSER_ROLE, _at(Keys.PROOFCHAIN_GOVERNOR));
        _grant(Keys.PROOFCHAIN_TIMELOCK, CANCELLER_ROLE, _at(Keys.PROOFCHAIN_GOVERNOR));

        // --- Wave A: keepers push feeds into the oracle-style modules. ---
        _grant(Keys.COLD_CHAIN_MONITOR, Roles.KEEPER_ROLE, keeper);
        _grant(Keys.PRICE_ORACLE, Roles.KEEPER_ROLE, keeper);
        _grant(Keys.IOT_SENSOR_REGISTRY, Roles.KEEPER_ROLE, keeper);
        _grant(Keys.ROUTE_ATTESTATION, Roles.KEEPER_ROLE, keeper);
        _grant(Keys.ORACLE_AGGREGATOR, Roles.KEEPER_ROLE, keeper);

        // --- Wave A: the AI verification agent attests DPP compliance, emissions & payroll delivery. ---
        _grant(Keys.DPP_COMPLIANCE_ORACLE, Roles.AGENT_ROLE, agent);
        _grant(Keys.EMISSIONS_TRADING, Roles.AGENT_ROLE, agent);
        _grant(Keys.MILESTONE_PAYROLL, Roles.AGENT_ROLE, agent);
    }

    // ------------------------------------------------------------------ output

    function _writeDeployments() internal {
        string memory obj = "platform";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeAddress(obj, "deployer", deployer);
        vm.serializeAddress(obj, "agent", agent);
        vm.serializeAddress(obj, "keeper", keeper);
        vm.serializeAddress(obj, "AddressBook", address(book));

        // Root + core
        vm.serializeAddress(obj, "ProvenanceRegistry", _at(Keys.PROVENANCE_REGISTRY));
        vm.serializeAddress(obj, "AttestationRegistry", _at(Keys.ATTESTATION_REGISTRY));
        vm.serializeAddress(obj, "SettlementEscrow", _at(Keys.SETTLEMENT_ESCROW));
        vm.serializeAddress(obj, "MockUSDC", _at(Keys.MOCK_USDC));
        vm.serializeAddress(obj, "Pauser", _at(Keys.PAUSER));

        // M1
        vm.serializeAddress(obj, "CheckpointOracle", _at(Keys.CHECKPOINT_ORACLE));
        vm.serializeAddress(obj, "ProvenanceFactory", _at(Keys.PROVENANCE_FACTORY));
        vm.serializeAddress(obj, "BatchMetadataStore", _at(Keys.BATCH_METADATA_STORE));

        // M2
        vm.serializeAddress(obj, "StablecoinRegistry", _at(Keys.STABLECOIN_REGISTRY));
        vm.serializeAddress(obj, "FeeManager", _at(Keys.FEE_MANAGER));
        vm.serializeAddress(obj, "Treasury", _at(Keys.TREASURY));
        vm.serializeAddress(obj, "PaymentRouter", _at(Keys.PAYMENT_ROUTER));
        vm.serializeAddress(obj, "EscrowFactory", _at(Keys.ESCROW_FACTORY));
        vm.serializeAddress(obj, "SettlementRouter", _at(Keys.SETTLEMENT_ROUTER));

        // M3
        vm.serializeAddress(obj, "OrganizationRegistry", _at(Keys.ORGANIZATION_REGISTRY));
        vm.serializeAddress(obj, "SupplierRegistry", _at(Keys.SUPPLIER_REGISTRY));
        vm.serializeAddress(obj, "BuyerRegistry", _at(Keys.BUYER_REGISTRY));
        vm.serializeAddress(obj, "CarrierRegistry", _at(Keys.CARRIER_REGISTRY));
        vm.serializeAddress(obj, "KYCRegistry", _at(Keys.KYC_REGISTRY));
        vm.serializeAddress(obj, "IdentityResolver", _at(Keys.IDENTITY_RESOLVER));

        // M4
        vm.serializeAddress(obj, "ReputationEngine", _at(Keys.REPUTATION_ENGINE));
        vm.serializeAddress(obj, "SupplierBond", _at(Keys.SUPPLIER_BOND));
        vm.serializeAddress(obj, "StakeManager", _at(Keys.STAKE_MANAGER));
        vm.serializeAddress(obj, "SlashingController", _at(Keys.SLASHING_CONTROLLER));
        vm.serializeAddress(obj, "ScoreOracle", _at(Keys.SCORE_ORACLE));

        // M5
        vm.serializeAddress(obj, "InvoiceNFT", _at(Keys.INVOICE_NFT));
        vm.serializeAddress(obj, "ReceivableRegistry", _at(Keys.RECEIVABLE_REGISTRY));
        vm.serializeAddress(obj, "InvoiceFinancing", _at(Keys.INVOICE_FINANCING));
        vm.serializeAddress(obj, "FinancingPool", _at(Keys.FINANCING_POOL));
        vm.serializeAddress(obj, "LenderVault", _at(Keys.LENDER_VAULT));
        vm.serializeAddress(obj, "DiscountCalculator", _at(Keys.DISCOUNT_CALCULATOR));
        vm.serializeAddress(obj, "YieldDistributor", _at(Keys.YIELD_DISTRIBUTOR));
        vm.serializeAddress(obj, "RepaymentController", _at(Keys.REPAYMENT_CONTROLLER));

        // M6
        vm.serializeAddress(obj, "InsurancePool", _at(Keys.INSURANCE_POOL));
        vm.serializeAddress(obj, "PolicyManager", _at(Keys.POLICY_MANAGER));
        vm.serializeAddress(obj, "ClaimsProcessor", _at(Keys.CLAIMS_PROCESSOR));
        vm.serializeAddress(obj, "PremiumCalculator", _at(Keys.PREMIUM_CALCULATOR));
        vm.serializeAddress(obj, "RiskPool", _at(Keys.RISK_POOL));

        // M7
        vm.serializeAddress(obj, "DisputeArbitration", _at(Keys.DISPUTE_ARBITRATION));
        vm.serializeAddress(obj, "ArbiterStaking", _at(Keys.ARBITER_STAKING));
        vm.serializeAddress(obj, "GovernanceToken", _at(Keys.GOVERNANCE_TOKEN));
        vm.serializeAddress(obj, "ProofChainGovernor", _at(Keys.PROOFCHAIN_GOVERNOR));
        vm.serializeAddress(obj, "ProofChainTimelock", _at(Keys.PROOFCHAIN_TIMELOCK));
        vm.serializeAddress(obj, "ProposalRegistry", _at(Keys.PROPOSAL_REGISTRY));

        // M8
        vm.serializeAddress(obj, "BatchNFT", _at(Keys.BATCH_NFT));
        vm.serializeAddress(obj, "WarehouseReceipt", _at(Keys.WAREHOUSE_RECEIPT));
        vm.serializeAddress(obj, "CarbonCreditToken", _at(Keys.CARBON_CREDIT_TOKEN));
        vm.serializeAddress(obj, "ESGRegistry", _at(Keys.ESG_REGISTRY));
        vm.serializeAddress(obj, "SustainabilityOracle", _at(Keys.SUSTAINABILITY_ORACLE));
        vm.serializeAddress(obj, "OffsetMarketplace", _at(Keys.OFFSET_MARKETPLACE));

        // M9
        vm.serializeAddress(obj, "ListingRegistry", _at(Keys.LISTING_REGISTRY));
        vm.serializeAddress(obj, "FinancingMarketplace", _at(Keys.FINANCING_MARKETPLACE));
        vm.serializeAddress(obj, "AuctionHouse", _at(Keys.AUCTION_HOUSE));
        vm.serializeAddress(obj, "OrderBook", _at(Keys.ORDER_BOOK));
        vm.serializeAddress(obj, "BidManager", _at(Keys.BID_MANAGER));

        // M10
        vm.serializeAddress(obj, "LoyaltyPoints", _at(Keys.LOYALTY_POINTS));
        vm.serializeAddress(obj, "RewardsDistributor", _at(Keys.REWARDS_DISTRIBUTOR));
        vm.serializeAddress(obj, "StakingRewards", _at(Keys.STAKING_REWARDS));
        vm.serializeAddress(obj, "ReferralProgram", _at(Keys.REFERRAL_PROGRAM));
        vm.serializeAddress(obj, "EmissionsController", _at(Keys.EMISSIONS_CONTROLLER));

        // Wave A: tradefinance
        vm.serializeAddress(obj, "LetterOfCredit", _at(Keys.LETTER_OF_CREDIT));
        vm.serializeAddress(obj, "BillOfExchange", _at(Keys.BILL_OF_EXCHANGE));
        vm.serializeAddress(obj, "FactoringAgreement", _at(Keys.FACTORING_AGREEMENT));
        vm.serializeAddress(obj, "PurchaseOrderFinancing", _at(Keys.PURCHASE_ORDER_FINANCING));
        vm.serializeAddress(obj, "DynamicDiscounting", _at(Keys.DYNAMIC_DISCOUNTING));
        vm.serializeAddress(obj, "SupplyChainFinance", _at(Keys.SUPPLY_CHAIN_FINANCE));
        vm.serializeAddress(obj, "ReceivableSecuritization", _at(Keys.RECEIVABLE_SECURITIZATION));
        vm.serializeAddress(obj, "TrancheToken", _at(Keys.TRANCHE_TOKEN));
        vm.serializeAddress(obj, "CreditLineManager", _at(Keys.CREDIT_LINE_MANAGER));
        vm.serializeAddress(obj, "GuaranteeRegistry", _at(Keys.GUARANTEE_REGISTRY));

        // Wave A: compliance
        vm.serializeAddress(obj, "SanctionsScreening", _at(Keys.SANCTIONS_SCREENING));
        vm.serializeAddress(obj, "AMLRegistry", _at(Keys.AML_REGISTRY));
        vm.serializeAddress(obj, "TradeComplianceEngine", _at(Keys.TRADE_COMPLIANCE_ENGINE));
        vm.serializeAddress(obj, "CertificateOfOrigin", _at(Keys.CERTIFICATE_OF_ORIGIN));
        vm.serializeAddress(obj, "PhytosanitaryCertificate", _at(Keys.PHYTOSANITARY_CERTIFICATE));
        vm.serializeAddress(obj, "HalalCertification", _at(Keys.HALAL_CERTIFICATION));
        vm.serializeAddress(obj, "ProductRecallRegistry", _at(Keys.PRODUCT_RECALL_REGISTRY));
        vm.serializeAddress(obj, "ExportLicenseRegistry", _at(Keys.EXPORT_LICENSE_REGISTRY));
        vm.serializeAddress(obj, "DutyAndTariffCalculator", _at(Keys.DUTY_AND_TARIFF_CALCULATOR));
        vm.serializeAddress(obj, "CustomsDeclaration", _at(Keys.CUSTOMS_DECLARATION));

        // Wave A: dpp
        vm.serializeAddress(obj, "DigitalProductPassport", _at(Keys.DIGITAL_PRODUCT_PASSPORT));
        vm.serializeAddress(obj, "DPPLifecycleRegistry", _at(Keys.DPP_LIFECYCLE_REGISTRY));
        vm.serializeAddress(obj, "MaterialComposition", _at(Keys.MATERIAL_COMPOSITION));
        vm.serializeAddress(obj, "RepairabilityIndex", _at(Keys.REPAIRABILITY_INDEX));
        vm.serializeAddress(obj, "RecyclingRegistry", _at(Keys.RECYCLING_REGISTRY));
        vm.serializeAddress(obj, "DPPDataCarrier", _at(Keys.DPP_DATA_CARRIER));
        vm.serializeAddress(obj, "DPPComplianceOracle", _at(Keys.DPP_COMPLIANCE_ORACLE));

        // Wave A: logistics
        vm.serializeAddress(obj, "FreightBooking", _at(Keys.FREIGHT_BOOKING));
        vm.serializeAddress(obj, "ColdChainMonitor", _at(Keys.COLD_CHAIN_MONITOR));
        vm.serializeAddress(obj, "BondedWarehouse", _at(Keys.BONDED_WAREHOUSE));
        vm.serializeAddress(obj, "FleetRegistry", _at(Keys.FLEET_REGISTRY));
        vm.serializeAddress(obj, "RouteAttestation", _at(Keys.ROUTE_ATTESTATION));
        vm.serializeAddress(obj, "CustomsBonded", _at(Keys.CUSTOMS_BONDED));
        vm.serializeAddress(obj, "ContainerRegistry", _at(Keys.CONTAINER_REGISTRY));
        vm.serializeAddress(obj, "LastMileProofOfDelivery", _at(Keys.LAST_MILE_PROOF_OF_DELIVERY));

        // Wave A: commodities
        vm.serializeAddress(obj, "CommodityVault", _at(Keys.COMMODITY_VAULT));
        vm.serializeAddress(obj, "CommodityToken", _at(Keys.COMMODITY_TOKEN));
        vm.serializeAddress(obj, "HarvestRegistry", _at(Keys.HARVEST_REGISTRY));
        vm.serializeAddress(obj, "GradingRegistry", _at(Keys.GRADING_REGISTRY));
        vm.serializeAddress(obj, "StorageReceipt", _at(Keys.STORAGE_RECEIPT));
        vm.serializeAddress(obj, "PriceOracle", _at(Keys.PRICE_ORACLE));

        // Wave A: energy
        vm.serializeAddress(obj, "RenewableEnergyCertificate", _at(Keys.RENEWABLE_ENERGY_CERTIFICATE));
        vm.serializeAddress(obj, "EmissionsTrading", _at(Keys.EMISSIONS_TRADING));
        vm.serializeAddress(obj, "WaterCredit", _at(Keys.WATER_CREDIT));
        vm.serializeAddress(obj, "BiodiversityCredit", _at(Keys.BIODIVERSITY_CREDIT));
        vm.serializeAddress(obj, "GreenBondIssuer", _at(Keys.GREEN_BOND_ISSUER));

        // Wave A: workforce
        vm.serializeAddress(obj, "WorkerCredential", _at(Keys.WORKER_CREDENTIAL));
        vm.serializeAddress(obj, "SafetyTrainingRegistry", _at(Keys.SAFETY_TRAINING_REGISTRY));
        vm.serializeAddress(obj, "MilestonePayroll", _at(Keys.MILESTONE_PAYROLL));
        vm.serializeAddress(obj, "SkillAttestation", _at(Keys.SKILL_ATTESTATION));
        vm.serializeAddress(obj, "LaborComplianceRegistry", _at(Keys.LABOR_COMPLIANCE_REGISTRY));

        // Wave A: data
        vm.serializeAddress(obj, "IoTSensorRegistry", _at(Keys.IOT_SENSOR_REGISTRY));
        vm.serializeAddress(obj, "QualityInspection", _at(Keys.QUALITY_INSPECTION));
        vm.serializeAddress(obj, "LabTestAttestation", _at(Keys.LAB_TEST_ATTESTATION));
        vm.serializeAddress(obj, "OracleAggregator", _at(Keys.ORACLE_AGGREGATOR));
        string memory json = vm.serializeAddress(obj, "DataMarketplace", _at(Keys.DATA_MARKETPLACE));

        vm.writeJson(json, "./deployments/base-sepolia.json");
    }
}
