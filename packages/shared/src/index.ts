/**
 * @proofchain/shared — the typed contract layer for ProofChain.
 *
 * Exposes: on-chain struct mirrors + agent verdict types, the Base Sepolia viem
 * chain config, contract ABIs, a chain-keyed address map, event-decoder helpers,
 * and structured error/result envelopes. No secrets live here.
 */

// ABIs and contract identity
export {
  ABIS,
  CONTRACT_NAMES,
  attestationRegistryAbi,
  getAbi,
  isContractName,
  mockUsdcAbi,
  provenanceRegistryAbi,
  settlementEscrowAbi,
  type ContractName,
} from "./abis/index";

// Chain config
export {
  CHAIN_ID,
  DEFAULT_BASE_SEPOLIA_RPC,
  RPC_URL_ENV,
  baseSepolia,
  createBaseSepoliaChain,
  isSupportedChainId,
  readEnv,
  type ChainId,
} from "./chains";

// Addresses
export {
  CONTRACTS,
  DEFAULT_DEPLOYMENTS_PATH,
  DEPLOYMENTS_PATH_ENV,
  addressesFromManifest,
  envOverridesFor,
  getContractAddress,
  parseAddress,
  readDeploymentManifest,
  resolveContractAddresses,
  toScreamingSnakeCase,
  tryGetContractAddress,
  type ContractAddresses,
} from "./addresses";

// Event decoders
export {
  decodeContractEvent,
  decodeProofchainLog,
  parseContractLogs,
  parseRawEventLog,
  tryDecodeProofchainLog,
  type DecodedProofchainEvent,
  type RawEventLog,
} from "./decoders";

// Types + schemas
export {
  AddressSchema,
  Bytes32Schema,
  DEAL_STATE_LABELS,
  DealState,
  FINDING_SEVERITIES,
  FindingSchema,
  HexSchema,
  ScoreBpsSchema,
  VerificationVerdictSchema,
  type Address,
  type Attestation,
  type Batch,
  type Bytes32,
  type Checkpoint,
  type Deal,
  type Finding,
  type FindingSeverity,
  type Hex,
  type VerificationVerdict,
} from "./types";

// Platform-expansion types + enums + label maps (SPEC2 modules)
export {
  // identity
  ACTOR_ROLE_LABELS,
  ActorRole,
  KYC_LEVEL_LABELS,
  KycLevel,
  ORG_TYPE_LABELS,
  OrgType,
  type ActorProfile,
  type BuyerProfile,
  type CarrierProfile,
  type Identity,
  type KycStatus,
  type Organization,
  type SupplierProfile,
  // reputation
  RISK_GRADE_LABELS,
  type Reputation,
  type RiskGrade,
  // finance
  INVOICE_LISTING_STATE_LABELS,
  InvoiceListingState,
  type InvoiceListing,
  type ReceivableTerms,
  // insurance
  CLAIM_STATE_LABELS,
  ClaimState,
  POLICY_STATE_LABELS,
  PolicyState,
  type Claim,
  type Policy,
  // governance / disputes
  DISPUTE_STATE_LABELS,
  DisputeState,
  type Dispute,
  type ProposalDescription,
  // esg
  type EsgRecord,
  type WarehouseReceiptData,
  // marketplace
  ASSET_KIND_LABELS,
  AUCTION_STATE_LABELS,
  AssetKind,
  AuctionState,
  MARKET_LISTING_STATUS_LABELS,
  MarketListingStatus,
  ORDER_SIDE_LABELS,
  OrderSide,
  type Auction,
  type FinancingOffer,
  type MarketListing,
  type Order,
  // provenance / payments support
  type MetadataKV,
  type Series,
  type TokenInfo,
  // rewards
  type RewardEpoch,
} from "./types";

// Struct decoders + label/number helpers
export {
  actorRoleLabel,
  assetKindLabel,
  auctionStateLabel,
  bpsToPercent,
  claimStateLabel,
  dealStateLabel,
  decodeActorProfile,
  decodeAuction,
  decodeClaim,
  decodeDispute,
  decodeEnum,
  decodeEsgRecord,
  decodeFinancingOffer,
  decodeIdentity,
  decodeInvoiceListing,
  decodeKycStatus,
  decodeMarketListing,
  decodeOrder,
  decodeOrganization,
  decodePolicy,
  decodeReceivableTerms,
  decodeReputation,
  decodeTokenInfo,
  disputeStateLabel,
  invoiceListingStateLabel,
  isPassingScore,
  kycLevelLabel,
  marketListingStatusLabel,
  orderSideLabel,
  orgTypeLabel,
  policyStateLabel,
  riskGradeLabel,
} from "./structs";

// Errors + result envelopes
export {
  DecodeError,
  DeploymentParseError,
  ErrorCode,
  InvalidAddressError,
  MissingAddressError,
  ProofchainError,
  ValidationError,
  fail,
  ok,
  toErrorEnvelope,
  type ErrorEnvelope,
  type Result,
} from "./errors";

// ---------------------------------------------------------------------------
// Domain barrels. These surface the per-contract `<Name>Abi` consts and every
// per-domain type/decoder/constant module the Domains phase adds. The explicit
// re-exports above always take precedence over these wildcard re-exports, so no
// previously-exported name changes meaning.
// ---------------------------------------------------------------------------
export * from "./abis/index";
export * from "./types/index";
export * from "./decoders/index";
export * from "./constants/index";
