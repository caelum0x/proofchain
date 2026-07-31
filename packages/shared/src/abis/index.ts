import type { Abi } from "viem";

import AddressBookJson from "./AddressBook.json";
import ArbiterStakingJson from "./ArbiterStaking.json";
import AttestationRegistryJson from "./AttestationRegistry.json";
import AuctionHouseJson from "./AuctionHouse.json";
import BatchMetadataStoreJson from "./BatchMetadataStore.json";
import BatchNFTJson from "./BatchNFT.json";
import BidManagerJson from "./BidManager.json";
import BuyerRegistryJson from "./BuyerRegistry.json";
import CarbonCreditTokenJson from "./CarbonCreditToken.json";
import CarrierRegistryJson from "./CarrierRegistry.json";
import CheckpointOracleJson from "./CheckpointOracle.json";
import ClaimsProcessorJson from "./ClaimsProcessor.json";
import DiscountCalculatorJson from "./DiscountCalculator.json";
import DisputeArbitrationJson from "./DisputeArbitration.json";
import EmissionsControllerJson from "./EmissionsController.json";
import ESGRegistryJson from "./ESGRegistry.json";
import EscrowFactoryJson from "./EscrowFactory.json";
import FeeManagerJson from "./FeeManager.json";
import FinancingMarketplaceJson from "./FinancingMarketplace.json";
import FinancingPoolJson from "./FinancingPool.json";
import GovernanceTokenJson from "./GovernanceToken.json";
import IdentityResolverJson from "./IdentityResolver.json";
import InsurancePoolJson from "./InsurancePool.json";
import InvoiceFinancingJson from "./InvoiceFinancing.json";
import InvoiceNFTJson from "./InvoiceNFT.json";
import KYCRegistryJson from "./KYCRegistry.json";
import LenderVaultJson from "./LenderVault.json";
import ListingRegistryJson from "./ListingRegistry.json";
import LoyaltyPointsJson from "./LoyaltyPoints.json";
import MockUsdcJson from "./MockUSDC.json";
import OffsetMarketplaceJson from "./OffsetMarketplace.json";
import OrderBookJson from "./OrderBook.json";
import OrganizationRegistryJson from "./OrganizationRegistry.json";
import PauserJson from "./Pauser.json";
import PaymentRouterJson from "./PaymentRouter.json";
import PolicyManagerJson from "./PolicyManager.json";
import PremiumCalculatorJson from "./PremiumCalculator.json";
import ProofChainGovernorJson from "./ProofChainGovernor.json";
import ProofChainTimelockJson from "./ProofChainTimelock.json";
import ProposalRegistryJson from "./ProposalRegistry.json";
import ProvenanceFactoryJson from "./ProvenanceFactory.json";
import ProvenanceRegistryJson from "./ProvenanceRegistry.json";
import ReceivableRegistryJson from "./ReceivableRegistry.json";
import ReferralProgramJson from "./ReferralProgram.json";
import RepaymentControllerJson from "./RepaymentController.json";
import ReputationEngineJson from "./ReputationEngine.json";
import RewardsDistributorJson from "./RewardsDistributor.json";
import RiskPoolJson from "./RiskPool.json";
import ScoreOracleJson from "./ScoreOracle.json";
import SettlementEscrowJson from "./SettlementEscrow.json";
import SettlementRouterJson from "./SettlementRouter.json";
import SlashingControllerJson from "./SlashingController.json";
import StablecoinRegistryJson from "./StablecoinRegistry.json";
import StakeManagerJson from "./StakeManager.json";
import StakingRewardsJson from "./StakingRewards.json";
import SupplierBondJson from "./SupplierBond.json";
import SupplierRegistryJson from "./SupplierRegistry.json";
import SustainabilityOracleJson from "./SustainabilityOracle.json";
import TreasuryJson from "./Treasury.json";
import WarehouseReceiptJson from "./WarehouseReceipt.json";
import YieldDistributorJson from "./YieldDistributor.json";

// Wave A: real-world trade domains
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
import DigitalProductPassportJson from "./DigitalProductPassport.json";
import DPPLifecycleRegistryJson from "./DPPLifecycleRegistry.json";
import MaterialCompositionJson from "./MaterialComposition.json";
import RepairabilityIndexJson from "./RepairabilityIndex.json";
import RecyclingRegistryJson from "./RecyclingRegistry.json";
import DPPDataCarrierJson from "./DPPDataCarrier.json";
import DPPComplianceOracleJson from "./DPPComplianceOracle.json";
import FreightBookingJson from "./FreightBooking.json";
import ColdChainMonitorJson from "./ColdChainMonitor.json";
import BondedWarehouseJson from "./BondedWarehouse.json";
import FleetRegistryJson from "./FleetRegistry.json";
import RouteAttestationJson from "./RouteAttestation.json";
import CustomsBondedJson from "./CustomsBonded.json";
import ContainerRegistryJson from "./ContainerRegistry.json";
import LastMileProofOfDeliveryJson from "./LastMileProofOfDelivery.json";
import CommodityTokenJson from "./CommodityToken.json";
import CommodityVaultJson from "./CommodityVault.json";
import HarvestRegistryJson from "./HarvestRegistry.json";
import GradingRegistryJson from "./GradingRegistry.json";
import StorageReceiptJson from "./StorageReceipt.json";
import PriceOracleJson from "./PriceOracle.json";
import RenewableEnergyCertificateJson from "./RenewableEnergyCertificate.json";
import EmissionsTradingJson from "./EmissionsTrading.json";
import WaterCreditJson from "./WaterCredit.json";
import BiodiversityCreditJson from "./BiodiversityCredit.json";
import GreenBondIssuerJson from "./GreenBondIssuer.json";
import WorkerCredentialJson from "./WorkerCredential.json";
import SafetyTrainingRegistryJson from "./SafetyTrainingRegistry.json";
import MilestonePayrollJson from "./MilestonePayroll.json";
import SkillAttestationJson from "./SkillAttestation.json";
import LaborComplianceRegistryJson from "./LaborComplianceRegistry.json";
import IoTSensorRegistryJson from "./IoTSensorRegistry.json";
import QualityInspectionJson from "./QualityInspection.json";
import LabTestAttestationJson from "./LabTestAttestation.json";
import OracleAggregatorJson from "./OracleAggregator.json";
import DataMarketplaceJson from "./DataMarketplace.json";

/**
 * The full set of ProofChain contract ABIs.
 *
 * These JSON files are the authoritative ABIs exported from the
 * `@proofchain/contracts` Foundry build (`export-abis.mjs`). They are re-exported
 * here through the generic `Abi` type so downstream code (agent, api, web) keeps
 * working across contract recompiles. No addresses or secrets live in this layer.
 *
 * The map covers every deployed contract in `deployments/base-sepolia.json`:
 * the original core four (Provenance/Attestation/Settlement/MockUSDC) plus the
 * ~57 platform-expansion contracts across identity, reputation, finance,
 * insurance, governance, ESG, marketplace, and rewards.
 */

/** Canonical contract names used as keys across the shared package. */
export const CONTRACT_NAMES = [
  "AddressBook",
  "ArbiterStaking",
  "AttestationRegistry",
  "AuctionHouse",
  "BatchMetadataStore",
  "BatchNFT",
  "BidManager",
  "BuyerRegistry",
  "CarbonCreditToken",
  "CarrierRegistry",
  "CheckpointOracle",
  "ClaimsProcessor",
  "DiscountCalculator",
  "DisputeArbitration",
  "EmissionsController",
  "ESGRegistry",
  "EscrowFactory",
  "FeeManager",
  "FinancingMarketplace",
  "FinancingPool",
  "GovernanceToken",
  "IdentityResolver",
  "InsurancePool",
  "InvoiceFinancing",
  "InvoiceNFT",
  "KYCRegistry",
  "LenderVault",
  "ListingRegistry",
  "LoyaltyPoints",
  "MockUSDC",
  "OffsetMarketplace",
  "OrderBook",
  "OrganizationRegistry",
  "Pauser",
  "PaymentRouter",
  "PolicyManager",
  "PremiumCalculator",
  "ProofChainGovernor",
  "ProofChainTimelock",
  "ProposalRegistry",
  "ProvenanceFactory",
  "ProvenanceRegistry",
  "ReceivableRegistry",
  "ReferralProgram",
  "RepaymentController",
  "ReputationEngine",
  "RewardsDistributor",
  "RiskPool",
  "ScoreOracle",
  "SettlementEscrow",
  "SettlementRouter",
  "SlashingController",
  "StablecoinRegistry",
  "StakeManager",
  "StakingRewards",
  "SupplierBond",
  "SupplierRegistry",
  "SustainabilityOracle",
  "Treasury",
  "WarehouseReceipt",
  "YieldDistributor",
  // Wave A
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
  "DigitalProductPassport",
  "DPPLifecycleRegistry",
  "MaterialComposition",
  "RepairabilityIndex",
  "RecyclingRegistry",
  "DPPDataCarrier",
  "DPPComplianceOracle",
  "FreightBooking",
  "ColdChainMonitor",
  "BondedWarehouse",
  "FleetRegistry",
  "RouteAttestation",
  "CustomsBonded",
  "ContainerRegistry",
  "LastMileProofOfDelivery",
  "CommodityToken",
  "CommodityVault",
  "HarvestRegistry",
  "GradingRegistry",
  "StorageReceipt",
  "PriceOracle",
  "RenewableEnergyCertificate",
  "EmissionsTrading",
  "WaterCredit",
  "BiodiversityCredit",
  "GreenBondIssuer",
  "WorkerCredential",
  "SafetyTrainingRegistry",
  "MilestonePayroll",
  "SkillAttestation",
  "LaborComplianceRegistry",
  "IoTSensorRegistry",
  "QualityInspection",
  "LabTestAttestation",
  "OracleAggregator",
  "DataMarketplace",
] as const;

export type ContractName = (typeof CONTRACT_NAMES)[number];

/**
 * Map of contract name to its ABI. Frozen so consumers cannot mutate the shared
 * registry. Keyed exactly by {@link CONTRACT_NAMES}.
 */
export const ABIS: Readonly<Record<ContractName, Abi>> = Object.freeze({
  AddressBook: AddressBookJson as Abi,
  ArbiterStaking: ArbiterStakingJson as Abi,
  AttestationRegistry: AttestationRegistryJson as Abi,
  AuctionHouse: AuctionHouseJson as Abi,
  BatchMetadataStore: BatchMetadataStoreJson as Abi,
  BatchNFT: BatchNFTJson as Abi,
  BidManager: BidManagerJson as Abi,
  BuyerRegistry: BuyerRegistryJson as Abi,
  CarbonCreditToken: CarbonCreditTokenJson as Abi,
  CarrierRegistry: CarrierRegistryJson as Abi,
  CheckpointOracle: CheckpointOracleJson as Abi,
  ClaimsProcessor: ClaimsProcessorJson as Abi,
  DiscountCalculator: DiscountCalculatorJson as Abi,
  DisputeArbitration: DisputeArbitrationJson as Abi,
  EmissionsController: EmissionsControllerJson as Abi,
  ESGRegistry: ESGRegistryJson as Abi,
  EscrowFactory: EscrowFactoryJson as Abi,
  FeeManager: FeeManagerJson as Abi,
  FinancingMarketplace: FinancingMarketplaceJson as Abi,
  FinancingPool: FinancingPoolJson as Abi,
  GovernanceToken: GovernanceTokenJson as Abi,
  IdentityResolver: IdentityResolverJson as Abi,
  InsurancePool: InsurancePoolJson as Abi,
  InvoiceFinancing: InvoiceFinancingJson as Abi,
  InvoiceNFT: InvoiceNFTJson as Abi,
  KYCRegistry: KYCRegistryJson as Abi,
  LenderVault: LenderVaultJson as Abi,
  ListingRegistry: ListingRegistryJson as Abi,
  LoyaltyPoints: LoyaltyPointsJson as Abi,
  MockUSDC: MockUsdcJson as Abi,
  OffsetMarketplace: OffsetMarketplaceJson as Abi,
  OrderBook: OrderBookJson as Abi,
  OrganizationRegistry: OrganizationRegistryJson as Abi,
  Pauser: PauserJson as Abi,
  PaymentRouter: PaymentRouterJson as Abi,
  PolicyManager: PolicyManagerJson as Abi,
  PremiumCalculator: PremiumCalculatorJson as Abi,
  ProofChainGovernor: ProofChainGovernorJson as Abi,
  ProofChainTimelock: ProofChainTimelockJson as Abi,
  ProposalRegistry: ProposalRegistryJson as Abi,
  ProvenanceFactory: ProvenanceFactoryJson as Abi,
  ProvenanceRegistry: ProvenanceRegistryJson as Abi,
  ReceivableRegistry: ReceivableRegistryJson as Abi,
  ReferralProgram: ReferralProgramJson as Abi,
  RepaymentController: RepaymentControllerJson as Abi,
  ReputationEngine: ReputationEngineJson as Abi,
  RewardsDistributor: RewardsDistributorJson as Abi,
  RiskPool: RiskPoolJson as Abi,
  ScoreOracle: ScoreOracleJson as Abi,
  SettlementEscrow: SettlementEscrowJson as Abi,
  SettlementRouter: SettlementRouterJson as Abi,
  SlashingController: SlashingControllerJson as Abi,
  StablecoinRegistry: StablecoinRegistryJson as Abi,
  StakeManager: StakeManagerJson as Abi,
  StakingRewards: StakingRewardsJson as Abi,
  SupplierBond: SupplierBondJson as Abi,
  SupplierRegistry: SupplierRegistryJson as Abi,
  SustainabilityOracle: SustainabilityOracleJson as Abi,
  Treasury: TreasuryJson as Abi,
  WarehouseReceipt: WarehouseReceiptJson as Abi,
  YieldDistributor: YieldDistributorJson as Abi,
  // Wave A
  LetterOfCredit: LetterOfCreditJson as Abi,
  BillOfExchange: BillOfExchangeJson as Abi,
  FactoringAgreement: FactoringAgreementJson as Abi,
  PurchaseOrderFinancing: PurchaseOrderFinancingJson as Abi,
  DynamicDiscounting: DynamicDiscountingJson as Abi,
  SupplyChainFinance: SupplyChainFinanceJson as Abi,
  ReceivableSecuritization: ReceivableSecuritizationJson as Abi,
  TrancheToken: TrancheTokenJson as Abi,
  CreditLineManager: CreditLineManagerJson as Abi,
  GuaranteeRegistry: GuaranteeRegistryJson as Abi,
  SanctionsScreening: SanctionsScreeningJson as Abi,
  AMLRegistry: AMLRegistryJson as Abi,
  TradeComplianceEngine: TradeComplianceEngineJson as Abi,
  CertificateOfOrigin: CertificateOfOriginJson as Abi,
  PhytosanitaryCertificate: PhytosanitaryCertificateJson as Abi,
  HalalCertification: HalalCertificationJson as Abi,
  ProductRecallRegistry: ProductRecallRegistryJson as Abi,
  ExportLicenseRegistry: ExportLicenseRegistryJson as Abi,
  DutyAndTariffCalculator: DutyAndTariffCalculatorJson as Abi,
  CustomsDeclaration: CustomsDeclarationJson as Abi,
  DigitalProductPassport: DigitalProductPassportJson as Abi,
  DPPLifecycleRegistry: DPPLifecycleRegistryJson as Abi,
  MaterialComposition: MaterialCompositionJson as Abi,
  RepairabilityIndex: RepairabilityIndexJson as Abi,
  RecyclingRegistry: RecyclingRegistryJson as Abi,
  DPPDataCarrier: DPPDataCarrierJson as Abi,
  DPPComplianceOracle: DPPComplianceOracleJson as Abi,
  FreightBooking: FreightBookingJson as Abi,
  ColdChainMonitor: ColdChainMonitorJson as Abi,
  BondedWarehouse: BondedWarehouseJson as Abi,
  FleetRegistry: FleetRegistryJson as Abi,
  RouteAttestation: RouteAttestationJson as Abi,
  CustomsBonded: CustomsBondedJson as Abi,
  ContainerRegistry: ContainerRegistryJson as Abi,
  LastMileProofOfDelivery: LastMileProofOfDeliveryJson as Abi,
  CommodityToken: CommodityTokenJson as Abi,
  CommodityVault: CommodityVaultJson as Abi,
  HarvestRegistry: HarvestRegistryJson as Abi,
  GradingRegistry: GradingRegistryJson as Abi,
  StorageReceipt: StorageReceiptJson as Abi,
  PriceOracle: PriceOracleJson as Abi,
  RenewableEnergyCertificate: RenewableEnergyCertificateJson as Abi,
  EmissionsTrading: EmissionsTradingJson as Abi,
  WaterCredit: WaterCreditJson as Abi,
  BiodiversityCredit: BiodiversityCreditJson as Abi,
  GreenBondIssuer: GreenBondIssuerJson as Abi,
  WorkerCredential: WorkerCredentialJson as Abi,
  SafetyTrainingRegistry: SafetyTrainingRegistryJson as Abi,
  MilestonePayroll: MilestonePayrollJson as Abi,
  SkillAttestation: SkillAttestationJson as Abi,
  LaborComplianceRegistry: LaborComplianceRegistryJson as Abi,
  IoTSensorRegistry: IoTSensorRegistryJson as Abi,
  QualityInspection: QualityInspectionJson as Abi,
  LabTestAttestation: LabTestAttestationJson as Abi,
  OracleAggregator: OracleAggregatorJson as Abi,
  DataMarketplace: DataMarketplaceJson as Abi,
});

// ---------------------------------------------------------------------------
// Legacy named exports (the original core four). Retained so existing agent/web
// imports keep resolving after the platform-expansion wiring.
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
