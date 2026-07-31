import type { Abi } from "viem";

// ---------------------------------------------------------------------------
// Raw ABI JSON imports (one per deployed contract, 117 total). Generated from
// the `@proofchain/contracts` Foundry build via `export-abis.mjs`.
// ---------------------------------------------------------------------------

// core / infrastructure
import AddressBookJson from "./AddressBook.json";

// provenance
import ProvenanceRegistryJson from "./ProvenanceRegistry.json";
import ProvenanceFactoryJson from "./ProvenanceFactory.json";
import AttestationRegistryJson from "./AttestationRegistry.json";
import BatchNFTJson from "./BatchNFT.json";
import BatchMetadataStoreJson from "./BatchMetadataStore.json";
import CheckpointOracleJson from "./CheckpointOracle.json";

// identity
import OrganizationRegistryJson from "./OrganizationRegistry.json";
import IdentityResolverJson from "./IdentityResolver.json";
import SupplierRegistryJson from "./SupplierRegistry.json";
import BuyerRegistryJson from "./BuyerRegistry.json";
import CarrierRegistryJson from "./CarrierRegistry.json";
import KYCRegistryJson from "./KYCRegistry.json";

// reputation
import ReputationEngineJson from "./ReputationEngine.json";
import ScoreOracleJson from "./ScoreOracle.json";
import SupplierBondJson from "./SupplierBond.json";
import ArbiterStakingJson from "./ArbiterStaking.json";
import StakeManagerJson from "./StakeManager.json";
import SlashingControllerJson from "./SlashingController.json";

// finance
import ReceivableRegistryJson from "./ReceivableRegistry.json";
import InvoiceNFTJson from "./InvoiceNFT.json";
import InvoiceFinancingJson from "./InvoiceFinancing.json";
import FinancingPoolJson from "./FinancingPool.json";
import LenderVaultJson from "./LenderVault.json";
import RepaymentControllerJson from "./RepaymentController.json";
import DiscountCalculatorJson from "./DiscountCalculator.json";
import YieldDistributorJson from "./YieldDistributor.json";

// payments
import SettlementEscrowJson from "./SettlementEscrow.json";
import SettlementRouterJson from "./SettlementRouter.json";
import EscrowFactoryJson from "./EscrowFactory.json";
import PaymentRouterJson from "./PaymentRouter.json";
import StablecoinRegistryJson from "./StablecoinRegistry.json";
import FeeManagerJson from "./FeeManager.json";
import MockUSDCJson from "./MockUSDC.json";

// insurance
import PolicyManagerJson from "./PolicyManager.json";
import ClaimsProcessorJson from "./ClaimsProcessor.json";
import InsurancePoolJson from "./InsurancePool.json";
import PremiumCalculatorJson from "./PremiumCalculator.json";
import RiskPoolJson from "./RiskPool.json";

// governance
import ProofChainGovernorJson from "./ProofChainGovernor.json";
import ProofChainTimelockJson from "./ProofChainTimelock.json";
import GovernanceTokenJson from "./GovernanceToken.json";
import ProposalRegistryJson from "./ProposalRegistry.json";
import DisputeArbitrationJson from "./DisputeArbitration.json";
import PauserJson from "./Pauser.json";
import TreasuryJson from "./Treasury.json";

// esg
import ESGRegistryJson from "./ESGRegistry.json";
import CarbonCreditTokenJson from "./CarbonCreditToken.json";
import SustainabilityOracleJson from "./SustainabilityOracle.json";
import EmissionsControllerJson from "./EmissionsController.json";
import OffsetMarketplaceJson from "./OffsetMarketplace.json";
import WarehouseReceiptJson from "./WarehouseReceipt.json";

// marketplace
import ListingRegistryJson from "./ListingRegistry.json";
import AuctionHouseJson from "./AuctionHouse.json";
import OrderBookJson from "./OrderBook.json";
import BidManagerJson from "./BidManager.json";
import FinancingMarketplaceJson from "./FinancingMarketplace.json";

// rewards
import RewardsDistributorJson from "./RewardsDistributor.json";
import LoyaltyPointsJson from "./LoyaltyPoints.json";
import ReferralProgramJson from "./ReferralProgram.json";
import StakingRewardsJson from "./StakingRewards.json";

// tradefinance
import LetterOfCreditJson from "./LetterOfCredit.json";
import BillOfExchangeJson from "./BillOfExchange.json";
import FactoringAgreementJson from "./FactoringAgreement.json";
import PurchaseOrderFinancingJson from "./PurchaseOrderFinancing.json";
import DynamicDiscountingJson from "./DynamicDiscounting.json";
import SupplyChainFinanceJson from "./SupplyChainFinance.json";
import ReceivableSecuritizationJson from "./ReceivableSecuritization.json";
import TrancheTokenJson from "./TrancheToken.json";
import CreditLineManagerJson from "./CreditLineManager.json";
import GuaranteeRegistryJson from "./GuaranteeRegistry.json";

// compliance
import SanctionsScreeningJson from "./SanctionsScreening.json";
import AMLRegistryJson from "./AMLRegistry.json";
import TradeComplianceEngineJson from "./TradeComplianceEngine.json";
import CertificateOfOriginJson from "./CertificateOfOrigin.json";
import PhytosanitaryCertificateJson from "./PhytosanitaryCertificate.json";
import HalalCertificationJson from "./HalalCertification.json";
import ProductRecallRegistryJson from "./ProductRecallRegistry.json";
import ExportLicenseRegistryJson from "./ExportLicenseRegistry.json";
import DutyAndTariffCalculatorJson from "./DutyAndTariffCalculator.json";
import CustomsDeclarationJson from "./CustomsDeclaration.json";

// dpp
import DigitalProductPassportJson from "./DigitalProductPassport.json";
import DPPLifecycleRegistryJson from "./DPPLifecycleRegistry.json";
import MaterialCompositionJson from "./MaterialComposition.json";
import RepairabilityIndexJson from "./RepairabilityIndex.json";
import RecyclingRegistryJson from "./RecyclingRegistry.json";
import DPPDataCarrierJson from "./DPPDataCarrier.json";
import DPPComplianceOracleJson from "./DPPComplianceOracle.json";

// logistics
import FreightBookingJson from "./FreightBooking.json";
import ColdChainMonitorJson from "./ColdChainMonitor.json";
import BondedWarehouseJson from "./BondedWarehouse.json";
import FleetRegistryJson from "./FleetRegistry.json";
import RouteAttestationJson from "./RouteAttestation.json";
import CustomsBondedJson from "./CustomsBonded.json";
import ContainerRegistryJson from "./ContainerRegistry.json";
import LastMileProofOfDeliveryJson from "./LastMileProofOfDelivery.json";

// commodities
import CommodityTokenJson from "./CommodityToken.json";
import CommodityVaultJson from "./CommodityVault.json";
import HarvestRegistryJson from "./HarvestRegistry.json";
import GradingRegistryJson from "./GradingRegistry.json";
import StorageReceiptJson from "./StorageReceipt.json";
import PriceOracleJson from "./PriceOracle.json";

// energy
import RenewableEnergyCertificateJson from "./RenewableEnergyCertificate.json";
import EmissionsTradingJson from "./EmissionsTrading.json";
import WaterCreditJson from "./WaterCredit.json";
import BiodiversityCreditJson from "./BiodiversityCredit.json";
import GreenBondIssuerJson from "./GreenBondIssuer.json";

// workforce
import WorkerCredentialJson from "./WorkerCredential.json";
import SafetyTrainingRegistryJson from "./SafetyTrainingRegistry.json";
import MilestonePayrollJson from "./MilestonePayroll.json";
import SkillAttestationJson from "./SkillAttestation.json";
import LaborComplianceRegistryJson from "./LaborComplianceRegistry.json";

// data
import IoTSensorRegistryJson from "./IoTSensorRegistry.json";
import QualityInspectionJson from "./QualityInspection.json";
import LabTestAttestationJson from "./LabTestAttestation.json";
import OracleAggregatorJson from "./OracleAggregator.json";
import DataMarketplaceJson from "./DataMarketplace.json";

/**
 * Canonical contract names used as keys across the shared package. Grouped by
 * domain; the ordering is stable and every name has a matching ABI JSON file and
 * an entry in {@link ABIS}, {@link CONTRACT_ABIS}, and the per-contract
 * `<Name>Abi` const exports below.
 */
export const CONTRACT_NAMES = [
  // core / infrastructure
  "AddressBook",
  // provenance
  "ProvenanceRegistry",
  "ProvenanceFactory",
  "AttestationRegistry",
  "BatchNFT",
  "BatchMetadataStore",
  "CheckpointOracle",
  // identity
  "OrganizationRegistry",
  "IdentityResolver",
  "SupplierRegistry",
  "BuyerRegistry",
  "CarrierRegistry",
  "KYCRegistry",
  // reputation
  "ReputationEngine",
  "ScoreOracle",
  "SupplierBond",
  "ArbiterStaking",
  "StakeManager",
  "SlashingController",
  // finance
  "ReceivableRegistry",
  "InvoiceNFT",
  "InvoiceFinancing",
  "FinancingPool",
  "LenderVault",
  "RepaymentController",
  "DiscountCalculator",
  "YieldDistributor",
  // payments
  "SettlementEscrow",
  "SettlementRouter",
  "EscrowFactory",
  "PaymentRouter",
  "StablecoinRegistry",
  "FeeManager",
  "MockUSDC",
  // insurance
  "PolicyManager",
  "ClaimsProcessor",
  "InsurancePool",
  "PremiumCalculator",
  "RiskPool",
  // governance
  "ProofChainGovernor",
  "ProofChainTimelock",
  "GovernanceToken",
  "ProposalRegistry",
  "DisputeArbitration",
  "Pauser",
  "Treasury",
  // esg
  "ESGRegistry",
  "CarbonCreditToken",
  "SustainabilityOracle",
  "EmissionsController",
  "OffsetMarketplace",
  "WarehouseReceipt",
  // marketplace
  "ListingRegistry",
  "AuctionHouse",
  "OrderBook",
  "BidManager",
  "FinancingMarketplace",
  // rewards
  "RewardsDistributor",
  "LoyaltyPoints",
  "ReferralProgram",
  "StakingRewards",
  // tradefinance
  "LetterOfCredit",
  "BillOfExchange",
  "FactoringAgreement",
  "PurchaseOrderFinancing",
  "DynamicDiscounting",
  "SupplyChainFinance",
  "ReceivableSecuritization",
  "TrancheToken",
  "CreditLineManager",
  "GuaranteeRegistry",
  // compliance
  "SanctionsScreening",
  "AMLRegistry",
  "TradeComplianceEngine",
  "CertificateOfOrigin",
  "PhytosanitaryCertificate",
  "HalalCertification",
  "ProductRecallRegistry",
  "ExportLicenseRegistry",
  "DutyAndTariffCalculator",
  "CustomsDeclaration",
  // dpp
  "DigitalProductPassport",
  "DPPLifecycleRegistry",
  "MaterialComposition",
  "RepairabilityIndex",
  "RecyclingRegistry",
  "DPPDataCarrier",
  "DPPComplianceOracle",
  // logistics
  "FreightBooking",
  "ColdChainMonitor",
  "BondedWarehouse",
  "FleetRegistry",
  "RouteAttestation",
  "CustomsBonded",
  "ContainerRegistry",
  "LastMileProofOfDelivery",
  // commodities
  "CommodityToken",
  "CommodityVault",
  "HarvestRegistry",
  "GradingRegistry",
  "StorageReceipt",
  "PriceOracle",
  // energy
  "RenewableEnergyCertificate",
  "EmissionsTrading",
  "WaterCredit",
  "BiodiversityCredit",
  "GreenBondIssuer",
  // workforce
  "WorkerCredential",
  "SafetyTrainingRegistry",
  "MilestonePayroll",
  "SkillAttestation",
  "LaborComplianceRegistry",
  // data
  "IoTSensorRegistry",
  "QualityInspection",
  "LabTestAttestation",
  "OracleAggregator",
  "DataMarketplace",
] as const;

export type ContractName = (typeof CONTRACT_NAMES)[number];

// ---------------------------------------------------------------------------
// Per-contract typed ABI consts. Each is the authoritative, immutable ABI for
// one contract, typed as viem's `Abi`. Exported individually (grouped by
// domain) so consumers can `import { SettlementEscrowAbi } from "@proofchain/shared"`
// and also collected into {@link CONTRACT_ABIS} / {@link ABIS} below.
// ---------------------------------------------------------------------------

// core / infrastructure
export const AddressBookAbi: Abi = AddressBookJson as Abi;

// provenance
export const ProvenanceRegistryAbi: Abi = ProvenanceRegistryJson as Abi;
export const ProvenanceFactoryAbi: Abi = ProvenanceFactoryJson as Abi;
export const AttestationRegistryAbi: Abi = AttestationRegistryJson as Abi;
export const BatchNFTAbi: Abi = BatchNFTJson as Abi;
export const BatchMetadataStoreAbi: Abi = BatchMetadataStoreJson as Abi;
export const CheckpointOracleAbi: Abi = CheckpointOracleJson as Abi;

// identity
export const OrganizationRegistryAbi: Abi = OrganizationRegistryJson as Abi;
export const IdentityResolverAbi: Abi = IdentityResolverJson as Abi;
export const SupplierRegistryAbi: Abi = SupplierRegistryJson as Abi;
export const BuyerRegistryAbi: Abi = BuyerRegistryJson as Abi;
export const CarrierRegistryAbi: Abi = CarrierRegistryJson as Abi;
export const KYCRegistryAbi: Abi = KYCRegistryJson as Abi;

// reputation
export const ReputationEngineAbi: Abi = ReputationEngineJson as Abi;
export const ScoreOracleAbi: Abi = ScoreOracleJson as Abi;
export const SupplierBondAbi: Abi = SupplierBondJson as Abi;
export const ArbiterStakingAbi: Abi = ArbiterStakingJson as Abi;
export const StakeManagerAbi: Abi = StakeManagerJson as Abi;
export const SlashingControllerAbi: Abi = SlashingControllerJson as Abi;

// finance
export const ReceivableRegistryAbi: Abi = ReceivableRegistryJson as Abi;
export const InvoiceNFTAbi: Abi = InvoiceNFTJson as Abi;
export const InvoiceFinancingAbi: Abi = InvoiceFinancingJson as Abi;
export const FinancingPoolAbi: Abi = FinancingPoolJson as Abi;
export const LenderVaultAbi: Abi = LenderVaultJson as Abi;
export const RepaymentControllerAbi: Abi = RepaymentControllerJson as Abi;
export const DiscountCalculatorAbi: Abi = DiscountCalculatorJson as Abi;
export const YieldDistributorAbi: Abi = YieldDistributorJson as Abi;

// payments
export const SettlementEscrowAbi: Abi = SettlementEscrowJson as Abi;
export const SettlementRouterAbi: Abi = SettlementRouterJson as Abi;
export const EscrowFactoryAbi: Abi = EscrowFactoryJson as Abi;
export const PaymentRouterAbi: Abi = PaymentRouterJson as Abi;
export const StablecoinRegistryAbi: Abi = StablecoinRegistryJson as Abi;
export const FeeManagerAbi: Abi = FeeManagerJson as Abi;
export const MockUSDCAbi: Abi = MockUSDCJson as Abi;

// insurance
export const PolicyManagerAbi: Abi = PolicyManagerJson as Abi;
export const ClaimsProcessorAbi: Abi = ClaimsProcessorJson as Abi;
export const InsurancePoolAbi: Abi = InsurancePoolJson as Abi;
export const PremiumCalculatorAbi: Abi = PremiumCalculatorJson as Abi;
export const RiskPoolAbi: Abi = RiskPoolJson as Abi;

// governance
export const ProofChainGovernorAbi: Abi = ProofChainGovernorJson as Abi;
export const ProofChainTimelockAbi: Abi = ProofChainTimelockJson as Abi;
export const GovernanceTokenAbi: Abi = GovernanceTokenJson as Abi;
export const ProposalRegistryAbi: Abi = ProposalRegistryJson as Abi;
export const DisputeArbitrationAbi: Abi = DisputeArbitrationJson as Abi;
export const PauserAbi: Abi = PauserJson as Abi;
export const TreasuryAbi: Abi = TreasuryJson as Abi;

// esg
export const ESGRegistryAbi: Abi = ESGRegistryJson as Abi;
export const CarbonCreditTokenAbi: Abi = CarbonCreditTokenJson as Abi;
export const SustainabilityOracleAbi: Abi = SustainabilityOracleJson as Abi;
export const EmissionsControllerAbi: Abi = EmissionsControllerJson as Abi;
export const OffsetMarketplaceAbi: Abi = OffsetMarketplaceJson as Abi;
export const WarehouseReceiptAbi: Abi = WarehouseReceiptJson as Abi;

// marketplace
export const ListingRegistryAbi: Abi = ListingRegistryJson as Abi;
export const AuctionHouseAbi: Abi = AuctionHouseJson as Abi;
export const OrderBookAbi: Abi = OrderBookJson as Abi;
export const BidManagerAbi: Abi = BidManagerJson as Abi;
export const FinancingMarketplaceAbi: Abi = FinancingMarketplaceJson as Abi;

// rewards
export const RewardsDistributorAbi: Abi = RewardsDistributorJson as Abi;
export const LoyaltyPointsAbi: Abi = LoyaltyPointsJson as Abi;
export const ReferralProgramAbi: Abi = ReferralProgramJson as Abi;
export const StakingRewardsAbi: Abi = StakingRewardsJson as Abi;

// tradefinance
export const LetterOfCreditAbi: Abi = LetterOfCreditJson as Abi;
export const BillOfExchangeAbi: Abi = BillOfExchangeJson as Abi;
export const FactoringAgreementAbi: Abi = FactoringAgreementJson as Abi;
export const PurchaseOrderFinancingAbi: Abi = PurchaseOrderFinancingJson as Abi;
export const DynamicDiscountingAbi: Abi = DynamicDiscountingJson as Abi;
export const SupplyChainFinanceAbi: Abi = SupplyChainFinanceJson as Abi;
export const ReceivableSecuritizationAbi: Abi = ReceivableSecuritizationJson as Abi;
export const TrancheTokenAbi: Abi = TrancheTokenJson as Abi;
export const CreditLineManagerAbi: Abi = CreditLineManagerJson as Abi;
export const GuaranteeRegistryAbi: Abi = GuaranteeRegistryJson as Abi;

// compliance
export const SanctionsScreeningAbi: Abi = SanctionsScreeningJson as Abi;
export const AMLRegistryAbi: Abi = AMLRegistryJson as Abi;
export const TradeComplianceEngineAbi: Abi = TradeComplianceEngineJson as Abi;
export const CertificateOfOriginAbi: Abi = CertificateOfOriginJson as Abi;
export const PhytosanitaryCertificateAbi: Abi = PhytosanitaryCertificateJson as Abi;
export const HalalCertificationAbi: Abi = HalalCertificationJson as Abi;
export const ProductRecallRegistryAbi: Abi = ProductRecallRegistryJson as Abi;
export const ExportLicenseRegistryAbi: Abi = ExportLicenseRegistryJson as Abi;
export const DutyAndTariffCalculatorAbi: Abi = DutyAndTariffCalculatorJson as Abi;
export const CustomsDeclarationAbi: Abi = CustomsDeclarationJson as Abi;

// dpp
export const DigitalProductPassportAbi: Abi = DigitalProductPassportJson as Abi;
export const DPPLifecycleRegistryAbi: Abi = DPPLifecycleRegistryJson as Abi;
export const MaterialCompositionAbi: Abi = MaterialCompositionJson as Abi;
export const RepairabilityIndexAbi: Abi = RepairabilityIndexJson as Abi;
export const RecyclingRegistryAbi: Abi = RecyclingRegistryJson as Abi;
export const DPPDataCarrierAbi: Abi = DPPDataCarrierJson as Abi;
export const DPPComplianceOracleAbi: Abi = DPPComplianceOracleJson as Abi;

// logistics
export const FreightBookingAbi: Abi = FreightBookingJson as Abi;
export const ColdChainMonitorAbi: Abi = ColdChainMonitorJson as Abi;
export const BondedWarehouseAbi: Abi = BondedWarehouseJson as Abi;
export const FleetRegistryAbi: Abi = FleetRegistryJson as Abi;
export const RouteAttestationAbi: Abi = RouteAttestationJson as Abi;
export const CustomsBondedAbi: Abi = CustomsBondedJson as Abi;
export const ContainerRegistryAbi: Abi = ContainerRegistryJson as Abi;
export const LastMileProofOfDeliveryAbi: Abi = LastMileProofOfDeliveryJson as Abi;

// commodities
export const CommodityTokenAbi: Abi = CommodityTokenJson as Abi;
export const CommodityVaultAbi: Abi = CommodityVaultJson as Abi;
export const HarvestRegistryAbi: Abi = HarvestRegistryJson as Abi;
export const GradingRegistryAbi: Abi = GradingRegistryJson as Abi;
export const StorageReceiptAbi: Abi = StorageReceiptJson as Abi;
export const PriceOracleAbi: Abi = PriceOracleJson as Abi;

// energy
export const RenewableEnergyCertificateAbi: Abi = RenewableEnergyCertificateJson as Abi;
export const EmissionsTradingAbi: Abi = EmissionsTradingJson as Abi;
export const WaterCreditAbi: Abi = WaterCreditJson as Abi;
export const BiodiversityCreditAbi: Abi = BiodiversityCreditJson as Abi;
export const GreenBondIssuerAbi: Abi = GreenBondIssuerJson as Abi;

// workforce
export const WorkerCredentialAbi: Abi = WorkerCredentialJson as Abi;
export const SafetyTrainingRegistryAbi: Abi = SafetyTrainingRegistryJson as Abi;
export const MilestonePayrollAbi: Abi = MilestonePayrollJson as Abi;
export const SkillAttestationAbi: Abi = SkillAttestationJson as Abi;
export const LaborComplianceRegistryAbi: Abi = LaborComplianceRegistryJson as Abi;

// data
export const IoTSensorRegistryAbi: Abi = IoTSensorRegistryJson as Abi;
export const QualityInspectionAbi: Abi = QualityInspectionJson as Abi;
export const LabTestAttestationAbi: Abi = LabTestAttestationJson as Abi;
export const OracleAggregatorAbi: Abi = OracleAggregatorJson as Abi;
export const DataMarketplaceAbi: Abi = DataMarketplaceJson as Abi;

/**
 * Map of contract name to its ABI. Frozen so consumers cannot mutate the shared
 * registry. Keyed exactly by {@link CONTRACT_NAMES}.
 */
export const ABIS: Readonly<Record<ContractName, Abi>> = Object.freeze({
  // core / infrastructure
  AddressBook: AddressBookAbi,
  // provenance
  ProvenanceRegistry: ProvenanceRegistryAbi,
  ProvenanceFactory: ProvenanceFactoryAbi,
  AttestationRegistry: AttestationRegistryAbi,
  BatchNFT: BatchNFTAbi,
  BatchMetadataStore: BatchMetadataStoreAbi,
  CheckpointOracle: CheckpointOracleAbi,
  // identity
  OrganizationRegistry: OrganizationRegistryAbi,
  IdentityResolver: IdentityResolverAbi,
  SupplierRegistry: SupplierRegistryAbi,
  BuyerRegistry: BuyerRegistryAbi,
  CarrierRegistry: CarrierRegistryAbi,
  KYCRegistry: KYCRegistryAbi,
  // reputation
  ReputationEngine: ReputationEngineAbi,
  ScoreOracle: ScoreOracleAbi,
  SupplierBond: SupplierBondAbi,
  ArbiterStaking: ArbiterStakingAbi,
  StakeManager: StakeManagerAbi,
  SlashingController: SlashingControllerAbi,
  // finance
  ReceivableRegistry: ReceivableRegistryAbi,
  InvoiceNFT: InvoiceNFTAbi,
  InvoiceFinancing: InvoiceFinancingAbi,
  FinancingPool: FinancingPoolAbi,
  LenderVault: LenderVaultAbi,
  RepaymentController: RepaymentControllerAbi,
  DiscountCalculator: DiscountCalculatorAbi,
  YieldDistributor: YieldDistributorAbi,
  // payments
  SettlementEscrow: SettlementEscrowAbi,
  SettlementRouter: SettlementRouterAbi,
  EscrowFactory: EscrowFactoryAbi,
  PaymentRouter: PaymentRouterAbi,
  StablecoinRegistry: StablecoinRegistryAbi,
  FeeManager: FeeManagerAbi,
  MockUSDC: MockUSDCAbi,
  // insurance
  PolicyManager: PolicyManagerAbi,
  ClaimsProcessor: ClaimsProcessorAbi,
  InsurancePool: InsurancePoolAbi,
  PremiumCalculator: PremiumCalculatorAbi,
  RiskPool: RiskPoolAbi,
  // governance
  ProofChainGovernor: ProofChainGovernorAbi,
  ProofChainTimelock: ProofChainTimelockAbi,
  GovernanceToken: GovernanceTokenAbi,
  ProposalRegistry: ProposalRegistryAbi,
  DisputeArbitration: DisputeArbitrationAbi,
  Pauser: PauserAbi,
  Treasury: TreasuryAbi,
  // esg
  ESGRegistry: ESGRegistryAbi,
  CarbonCreditToken: CarbonCreditTokenAbi,
  SustainabilityOracle: SustainabilityOracleAbi,
  EmissionsController: EmissionsControllerAbi,
  OffsetMarketplace: OffsetMarketplaceAbi,
  WarehouseReceipt: WarehouseReceiptAbi,
  // marketplace
  ListingRegistry: ListingRegistryAbi,
  AuctionHouse: AuctionHouseAbi,
  OrderBook: OrderBookAbi,
  BidManager: BidManagerAbi,
  FinancingMarketplace: FinancingMarketplaceAbi,
  // rewards
  RewardsDistributor: RewardsDistributorAbi,
  LoyaltyPoints: LoyaltyPointsAbi,
  ReferralProgram: ReferralProgramAbi,
  StakingRewards: StakingRewardsAbi,
  // tradefinance
  LetterOfCredit: LetterOfCreditAbi,
  BillOfExchange: BillOfExchangeAbi,
  FactoringAgreement: FactoringAgreementAbi,
  PurchaseOrderFinancing: PurchaseOrderFinancingAbi,
  DynamicDiscounting: DynamicDiscountingAbi,
  SupplyChainFinance: SupplyChainFinanceAbi,
  ReceivableSecuritization: ReceivableSecuritizationAbi,
  TrancheToken: TrancheTokenAbi,
  CreditLineManager: CreditLineManagerAbi,
  GuaranteeRegistry: GuaranteeRegistryAbi,
  // compliance
  SanctionsScreening: SanctionsScreeningAbi,
  AMLRegistry: AMLRegistryAbi,
  TradeComplianceEngine: TradeComplianceEngineAbi,
  CertificateOfOrigin: CertificateOfOriginAbi,
  PhytosanitaryCertificate: PhytosanitaryCertificateAbi,
  HalalCertification: HalalCertificationAbi,
  ProductRecallRegistry: ProductRecallRegistryAbi,
  ExportLicenseRegistry: ExportLicenseRegistryAbi,
  DutyAndTariffCalculator: DutyAndTariffCalculatorAbi,
  CustomsDeclaration: CustomsDeclarationAbi,
  // dpp
  DigitalProductPassport: DigitalProductPassportAbi,
  DPPLifecycleRegistry: DPPLifecycleRegistryAbi,
  MaterialComposition: MaterialCompositionAbi,
  RepairabilityIndex: RepairabilityIndexAbi,
  RecyclingRegistry: RecyclingRegistryAbi,
  DPPDataCarrier: DPPDataCarrierAbi,
  DPPComplianceOracle: DPPComplianceOracleAbi,
  // logistics
  FreightBooking: FreightBookingAbi,
  ColdChainMonitor: ColdChainMonitorAbi,
  BondedWarehouse: BondedWarehouseAbi,
  FleetRegistry: FleetRegistryAbi,
  RouteAttestation: RouteAttestationAbi,
  CustomsBonded: CustomsBondedAbi,
  ContainerRegistry: ContainerRegistryAbi,
  LastMileProofOfDelivery: LastMileProofOfDeliveryAbi,
  // commodities
  CommodityToken: CommodityTokenAbi,
  CommodityVault: CommodityVaultAbi,
  HarvestRegistry: HarvestRegistryAbi,
  GradingRegistry: GradingRegistryAbi,
  StorageReceipt: StorageReceiptAbi,
  PriceOracle: PriceOracleAbi,
  // energy
  RenewableEnergyCertificate: RenewableEnergyCertificateAbi,
  EmissionsTrading: EmissionsTradingAbi,
  WaterCredit: WaterCreditAbi,
  BiodiversityCredit: BiodiversityCreditAbi,
  GreenBondIssuer: GreenBondIssuerAbi,
  // workforce
  WorkerCredential: WorkerCredentialAbi,
  SafetyTrainingRegistry: SafetyTrainingRegistryAbi,
  MilestonePayroll: MilestonePayrollAbi,
  SkillAttestation: SkillAttestationAbi,
  LaborComplianceRegistry: LaborComplianceRegistryAbi,
  // data
  IoTSensorRegistry: IoTSensorRegistryAbi,
  QualityInspection: QualityInspectionAbi,
  LabTestAttestation: LabTestAttestationAbi,
  OracleAggregator: OracleAggregatorAbi,
  DataMarketplace: DataMarketplaceAbi,
});

/** Alias of {@link ABIS}; the domain-oriented name for the same frozen registry. */
export const CONTRACT_ABIS = ABIS;

// ---------------------------------------------------------------------------
// Legacy named exports (the original core four). Retained so existing agent/web
// imports keep resolving.
// ---------------------------------------------------------------------------

export const provenanceRegistryAbi: Abi = ABIS.ProvenanceRegistry;
export const attestationRegistryAbi: Abi = ABIS.AttestationRegistry;
export const settlementEscrowAbi: Abi = ABIS.SettlementEscrow;
export const mockUsdcAbi: Abi = ABIS.MockUSDC;

/** Type guard: is `value` one of the known contract names? */
export function isContractName(value: unknown): value is ContractName {
  return (
    typeof value === "string" &&
    (CONTRACT_NAMES as readonly string[]).includes(value)
  );
}

/**
 * Look up a contract ABI by name. Throws a `RangeError` for an unknown name so
 * callers fail fast instead of passing `undefined` into viem.
 */
export function getAbi(name: ContractName): Abi {
  const abi = ABIS[name];
  if (abi === undefined) {
    throw new RangeError(`Unknown contract name: ${String(name)}`);
  }
  return abi;
}
