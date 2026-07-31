import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitive branded schemas (validated at every boundary)
// ---------------------------------------------------------------------------

/** 0x-prefixed hex string of arbitrary length. */
export const HexSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]*$/u, "Expected a 0x-prefixed hex string");
export type Hex = `0x${string}`;

/** 20-byte EVM address (checksum not enforced here; use `parseAddress`). */
export const AddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/u, "Expected a 20-byte 0x address")
  .transform((v) => v as `0x${string}`);
export type Address = `0x${string}`;

/** 32-byte hash / id. */
export const Bytes32Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/u, "Expected a 32-byte 0x hash");
export type Bytes32 = `0x${string}`;

/** Basis-points score in the inclusive range 0..10000. */
export const ScoreBpsSchema = z
  .number()
  .int("Score must be an integer")
  .min(0, "Score must be >= 0")
  .max(10000, "Score must be <= 10000");

// ---------------------------------------------------------------------------
// On-chain struct mirrors
// ---------------------------------------------------------------------------

/** Mirror of `ProvenanceRegistry.Batch`. */
export interface Batch {
  readonly batchId: Bytes32;
  readonly supplier: Address;
  readonly originHash: Bytes32;
  readonly metadataURI: string;
  readonly createdAt: bigint;
  readonly exists: boolean;
}

/** Mirror of `ProvenanceRegistry.Checkpoint`. */
export interface Checkpoint {
  readonly batchId: Bytes32;
  readonly location: string;
  readonly timestamp: bigint;
  readonly dataHash: Bytes32;
}

/** Mirror of `AttestationRegistry.Attestation`. */
export interface Attestation {
  readonly batchId: Bytes32;
  readonly score: number; // uint16 bps, safely fits in JS number
  readonly verdictHash: Bytes32;
  readonly verdictURI: string;
  readonly attestedAt: bigint;
  readonly agent: Address;
  readonly exists: boolean;
}

/**
 * Mirror of `SettlementEscrow.DealState`. Numeric values MUST match the
 * Solidity enum ordering exactly.
 */
export enum DealState {
  None = 0,
  Funded = 1,
  Released = 2,
  Refunded = 3,
  Disputed = 4,
}

/** Human-readable labels for {@link DealState}, indexable by enum value. */
export const DEAL_STATE_LABELS: Readonly<Record<DealState, string>> = Object.freeze({
  [DealState.None]: "None",
  [DealState.Funded]: "Funded",
  [DealState.Released]: "Released",
  [DealState.Refunded]: "Refunded",
  [DealState.Disputed]: "Disputed",
});

/** Mirror of `SettlementEscrow.Deal`. */
export interface Deal {
  readonly batchId: Bytes32;
  readonly buyer: Address;
  readonly supplier: Address;
  readonly token: Address;
  readonly amount: bigint;
  readonly state: DealState;
}

// ---------------------------------------------------------------------------
// Agent verdict types (EXACTLY as defined in the spec)
// ---------------------------------------------------------------------------

export interface VerificationVerdict {
  batchId: `0x${string}`;
  score: number; // 0..10000 bps
  passed: boolean; // score >= threshold
  threshold: number; // bps used
  findings: Finding[]; // structured anomaly list
  documentHashes: string[]; // sha256 of each inspected doc
  verdictURI?: string; // IPFS URI once pinned
  createdAt: string; // ISO
  model: string; // agent model id
}

export interface Finding {
  code: string; // e.g. "INVOICE_TOTAL_MISMATCH"
  severity: "info" | "low" | "medium" | "high" | "critical";
  message: string;
  evidence?: Record<string, unknown>;
}

/** Allowed finding severities, ordered from least to most severe. */
export const FINDING_SEVERITIES = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

// ---------------------------------------------------------------------------
// Zod schemas for the verdict types (runtime validation of agent I/O)
// ---------------------------------------------------------------------------

export const FindingSchema: z.ZodType<Finding> = z.object({
  code: z.string().min(1, "Finding code must not be empty"),
  severity: z.enum(FINDING_SEVERITIES),
  message: z.string().min(1, "Finding message must not be empty"),
  evidence: z.record(z.string(), z.unknown()).optional(),
});

export const VerificationVerdictSchema: z.ZodType<VerificationVerdict> = z
  .object({
    batchId: Bytes32Schema.transform((v) => v as `0x${string}`),
    score: ScoreBpsSchema,
    passed: z.boolean(),
    threshold: ScoreBpsSchema,
    findings: z.array(FindingSchema),
    documentHashes: z.array(z.string().min(1)),
    verdictURI: z.string().min(1).optional(),
    createdAt: z.string().datetime({ offset: true }),
    model: z.string().min(1),
  })
  .superRefine((verdict, ctx) => {
    const expectedPass = verdict.score >= verdict.threshold;
    if (verdict.passed !== expectedPass) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passed"],
        message: `"passed" (${verdict.passed}) is inconsistent with score ${verdict.score} vs threshold ${verdict.threshold}`,
      });
    }
  }) as unknown as z.ZodType<VerificationVerdict>;

// ===========================================================================
// Platform-expansion types (SPEC2 modules). Numeric enum values MUST match the
// Solidity `enum` declaration order exactly — they are read straight off-chain.
// ===========================================================================

// ---------------------------------------------------------------------------
// M3 — identity
// ---------------------------------------------------------------------------

/** Mirror of `IOrganizationRegistry.OrgType`. */
export enum OrgType {
  Unknown = 0,
  Supplier = 1,
  Buyer = 2,
  Carrier = 3,
  Lender = 4,
  Insurer = 5,
  Other = 6,
}

export const ORG_TYPE_LABELS: Readonly<Record<OrgType, string>> = Object.freeze({
  [OrgType.Unknown]: "Unknown",
  [OrgType.Supplier]: "Supplier",
  [OrgType.Buyer]: "Buyer",
  [OrgType.Carrier]: "Carrier",
  [OrgType.Lender]: "Lender",
  [OrgType.Insurer]: "Insurer",
  [OrgType.Other]: "Other",
});

/** Mirror of `IOrganizationRegistry.Organization`. */
export interface Organization {
  readonly orgId: Bytes32;
  readonly name: string;
  readonly orgType: OrgType;
  readonly metadataURI: string;
  readonly admin: Address;
  readonly createdAt: bigint;
  readonly exists: boolean;
}

/**
 * Mirror of the shared `Profile` struct used identically by
 * `ISupplierRegistry`, `IBuyerRegistry`, and `ICarrierRegistry`.
 */
export interface ActorProfile {
  readonly account: Address;
  readonly name: string;
  readonly uri: string;
  readonly registeredAt: bigint;
  readonly exists: boolean;
}

export type SupplierProfile = ActorProfile;
export type BuyerProfile = ActorProfile;
export type CarrierProfile = ActorProfile;

/** Mirror of `IKYCRegistry.KycLevel` (higher == stronger verification). */
export enum KycLevel {
  None = 0,
  Basic = 1,
  Verified = 2,
  Enhanced = 3,
}

export const KYC_LEVEL_LABELS: Readonly<Record<KycLevel, string>> =
  Object.freeze({
    [KycLevel.None]: "None",
    [KycLevel.Basic]: "Basic",
    [KycLevel.Verified]: "Verified",
    [KycLevel.Enhanced]: "Enhanced",
  });

/** Mirror of `IKYCRegistry.KycStatus`. */
export interface KycStatus {
  readonly level: KycLevel;
  readonly updatedAt: bigint;
  readonly provider: Address;
}

/** Mirror of `IIdentityResolver.ActorRole`. */
export enum ActorRole {
  Unknown = 0,
  Supplier = 1,
  Buyer = 2,
  Carrier = 3,
}

export const ACTOR_ROLE_LABELS: Readonly<Record<ActorRole, string>> =
  Object.freeze({
    [ActorRole.Unknown]: "Unknown",
    [ActorRole.Supplier]: "Supplier",
    [ActorRole.Buyer]: "Buyer",
    [ActorRole.Carrier]: "Carrier",
  });

/** Mirror of `IIdentityResolver.Identity`. */
export interface Identity {
  readonly role: ActorRole;
  readonly orgId: Bytes32;
  readonly name: string;
}

// ---------------------------------------------------------------------------
// M4 — reputation & bonds
// ---------------------------------------------------------------------------

/** Mirror of `IReputationEngine.Reputation`. */
export interface Reputation {
  readonly avgScoreBps: number; // uint16 bps
  readonly totalDeals: bigint;
  readonly passRateBps: number; // uint16 bps
  readonly disputes: bigint;
}

/**
 * Composite risk grade from `IScoreOracle.gradeOf`: 0 = ungraded, 1 = best ..
 * 7 = worst.
 */
export type RiskGrade = number;

export const RISK_GRADE_LABELS: Readonly<Record<number, string>> = Object.freeze(
  {
    0: "Ungraded",
    1: "A+",
    2: "A",
    3: "B",
    4: "C",
    5: "D",
    6: "E",
    7: "F",
  },
);

// ---------------------------------------------------------------------------
// M5 — invoice financing / RWA
// ---------------------------------------------------------------------------

/** Mirror of `IReceivableRegistry.Terms`. */
export interface ReceivableTerms {
  readonly batchId: Bytes32;
  readonly faceValue: bigint;
  readonly dueDate: bigint;
  readonly obligor: Address;
  readonly token: Address;
  readonly exists: boolean;
}

/** Mirror of `IInvoiceFinancing.ListingState`. */
export enum InvoiceListingState {
  None = 0,
  Listed = 1,
  Funded = 2,
  Claimed = 3,
  Cancelled = 4,
}

export const INVOICE_LISTING_STATE_LABELS: Readonly<
  Record<InvoiceListingState, string>
> = Object.freeze({
  [InvoiceListingState.None]: "None",
  [InvoiceListingState.Listed]: "Listed",
  [InvoiceListingState.Funded]: "Funded",
  [InvoiceListingState.Claimed]: "Claimed",
  [InvoiceListingState.Cancelled]: "Cancelled",
});

/** Mirror of `IInvoiceFinancing.Listing`. */
export interface InvoiceListing {
  readonly batchId: Bytes32;
  readonly supplier: Address;
  readonly lender: Address;
  readonly token: Address;
  readonly askAmount: bigint;
  readonly state: InvoiceListingState;
}

// ---------------------------------------------------------------------------
// M6 — insurance
// ---------------------------------------------------------------------------

/** Mirror of `IPolicyManager.PolicyState`. */
export enum PolicyState {
  None = 0,
  Active = 1,
  Claimed = 2,
  Expired = 3,
  Cancelled = 4,
}

export const POLICY_STATE_LABELS: Readonly<Record<PolicyState, string>> =
  Object.freeze({
    [PolicyState.None]: "None",
    [PolicyState.Active]: "Active",
    [PolicyState.Claimed]: "Claimed",
    [PolicyState.Expired]: "Expired",
    [PolicyState.Cancelled]: "Cancelled",
  });

/** Mirror of `IPolicyManager.Policy`. */
export interface Policy {
  readonly policyId: Bytes32;
  readonly batchId: Bytes32;
  readonly holder: Address;
  readonly token: Address;
  readonly coverage: bigint;
  readonly premium: bigint;
  readonly issuedAt: bigint;
  readonly state: PolicyState;
}

/** Mirror of `IClaimsProcessor.ClaimState`. */
export enum ClaimState {
  None = 0,
  Filed = 1,
  Approved = 2,
  Rejected = 3,
  Paid = 4,
}

export const CLAIM_STATE_LABELS: Readonly<Record<ClaimState, string>> =
  Object.freeze({
    [ClaimState.None]: "None",
    [ClaimState.Filed]: "Filed",
    [ClaimState.Approved]: "Approved",
    [ClaimState.Rejected]: "Rejected",
    [ClaimState.Paid]: "Paid",
  });

/** Mirror of `IClaimsProcessor.Claim`. */
export interface Claim {
  readonly claimId: Bytes32;
  readonly policyId: Bytes32;
  readonly claimant: Address;
  readonly amount: bigint;
  readonly state: ClaimState;
  readonly filedAt: bigint;
}

// ---------------------------------------------------------------------------
// M7 — disputes & governance
// ---------------------------------------------------------------------------

/** Mirror of `IDisputeArbitration.DisputeState`. */
export enum DisputeState {
  None = 0,
  Open = 1,
  Resolved = 2,
}

export const DISPUTE_STATE_LABELS: Readonly<Record<DisputeState, string>> =
  Object.freeze({
    [DisputeState.None]: "None",
    [DisputeState.Open]: "Open",
    [DisputeState.Resolved]: "Resolved",
  });

/** Mirror of `IDisputeArbitration.Dispute`. */
export interface Dispute {
  readonly batchId: Bytes32;
  readonly openedAt: bigint;
  readonly votesRefund: bigint;
  readonly votesRelease: bigint;
  readonly state: DisputeState;
  readonly refundedBuyer: boolean;
}

/** Mirror of `ProposalRegistry.Description`. */
export interface ProposalDescription {
  readonly uri: string;
  readonly author: Address;
  readonly describedAt: bigint;
}

// ---------------------------------------------------------------------------
// M8 — tokenization & ESG
// ---------------------------------------------------------------------------

/** Mirror of `IESGRegistry.EsgRecord`. */
export interface EsgRecord {
  readonly subject: Bytes32;
  readonly score: number; // uint16
  readonly uri: string;
  readonly updatedAt: bigint;
  readonly attestor: Address;
  readonly exists: boolean;
}

/** Mirror of `IWarehouseReceipt.Receipt`. */
export interface WarehouseReceiptData {
  readonly tokenId: bigint;
  readonly batchId: Bytes32;
  readonly quantity: bigint;
  readonly location: string;
  readonly redeemed: boolean;
}

// ---------------------------------------------------------------------------
// M9 — marketplace
// ---------------------------------------------------------------------------

/** Mirror of `IListingRegistry.AssetKind`. */
export enum AssetKind {
  Unknown = 0,
  Receivable = 1,
  ERC721 = 2,
  ERC1155 = 3,
}

export const ASSET_KIND_LABELS: Readonly<Record<AssetKind, string>> =
  Object.freeze({
    [AssetKind.Unknown]: "Unknown",
    [AssetKind.Receivable]: "Receivable",
    [AssetKind.ERC721]: "ERC721",
    [AssetKind.ERC1155]: "ERC1155",
  });

/** Mirror of `IListingRegistry.ListingStatus`. */
export enum MarketListingStatus {
  None = 0,
  Active = 1,
  Cancelled = 2,
  Filled = 3,
}

export const MARKET_LISTING_STATUS_LABELS: Readonly<
  Record<MarketListingStatus, string>
> = Object.freeze({
  [MarketListingStatus.None]: "None",
  [MarketListingStatus.Active]: "Active",
  [MarketListingStatus.Cancelled]: "Cancelled",
  [MarketListingStatus.Filled]: "Filled",
});

/** Mirror of `IListingRegistry.Listing`. */
export interface MarketListing {
  readonly listingId: bigint;
  readonly kind: AssetKind;
  readonly asset: Address;
  readonly assetId: bigint;
  readonly amount: bigint;
  readonly seller: Address;
  readonly paymentToken: Address;
  readonly price: bigint;
  readonly status: MarketListingStatus;
}

/** Mirror of `IFinancingMarketplace.Offer`. */
export interface FinancingOffer {
  readonly offerId: bigint;
  readonly batchId: Bytes32;
  readonly maker: Address;
  readonly token: Address;
  readonly amount: bigint;
  readonly taken: boolean;
  readonly cancelled: boolean;
}

/** Mirror of `IAuctionHouse.AuctionState`. */
export enum AuctionState {
  None = 0,
  Active = 1,
  Settled = 2,
  Cancelled = 3,
}

export const AUCTION_STATE_LABELS: Readonly<Record<AuctionState, string>> =
  Object.freeze({
    [AuctionState.None]: "None",
    [AuctionState.Active]: "Active",
    [AuctionState.Settled]: "Settled",
    [AuctionState.Cancelled]: "Cancelled",
  });

/** Mirror of `IAuctionHouse.Auction`. */
export interface Auction {
  readonly auctionId: bigint;
  readonly nft: Address;
  readonly tokenId: bigint;
  readonly seller: Address;
  readonly paymentToken: Address;
  readonly reservePrice: bigint;
  readonly highestBid: bigint;
  readonly highestBidder: Address;
  readonly endTime: bigint;
  readonly state: AuctionState;
}

/** Mirror of `IOrderBook.Side`. */
export enum OrderSide {
  Buy = 0,
  Sell = 1,
}

export const ORDER_SIDE_LABELS: Readonly<Record<OrderSide, string>> =
  Object.freeze({
    [OrderSide.Buy]: "Buy",
    [OrderSide.Sell]: "Sell",
  });

/** Mirror of `IOrderBook.Order`. */
export interface Order {
  readonly orderId: bigint;
  readonly side: OrderSide;
  readonly asset: Address;
  readonly assetId: bigint;
  readonly paymentToken: Address;
  readonly price: bigint;
  readonly quantity: bigint;
  readonly filled: bigint;
  readonly maker: Address;
  readonly cancelled: boolean;
}

// ---------------------------------------------------------------------------
// M1 / M2 — provenance & payments support structs
// ---------------------------------------------------------------------------

/** Mirror of `IStablecoinRegistry.TokenInfo`. */
export interface TokenInfo {
  readonly token: Address;
  readonly decimals: number; // uint8
  readonly accepted: boolean;
}

/** Mirror of `IProvenanceFactory.Series`. */
export interface Series {
  readonly seriesId: Bytes32;
  readonly creator: Address;
  readonly metadataURI: string;
  readonly createdAt: bigint;
  readonly count: bigint;
  readonly exists: boolean;
}

/** Mirror of `IBatchMetadataStore.KV`. */
export interface MetadataKV {
  readonly key: Bytes32;
  readonly value: string;
}

// ---------------------------------------------------------------------------
// M10 — rewards
// ---------------------------------------------------------------------------

/** Mirror of `RewardsDistributor.Epoch`. */
export interface RewardEpoch {
  readonly root: Bytes32;
  readonly token: Address;
}
