/**
 * Runtime decoders + label helpers for the platform-expansion structs.
 *
 * On-chain reads (viem `readContract`) return struct tuples as objects with
 * `bigint` for uint256/uint64, `number` for uint8/uint16, and `0x`-strings for
 * addresses/bytes32. These decoders validate that raw shape at the boundary and
 * normalize it into the immutable, branded TS mirrors declared in `types.ts`.
 * They also accept numeric strings for the big-integer fields so the same
 * helpers work on JSON payloads relayed by the API layer.
 *
 * Every decoder throws {@link ValidationError} on malformed input — no silent
 * coercion of bad data.
 */
import { z } from "zod";

import { ValidationError } from "./errors";
import {
  AddressSchema,
  ActorRole,
  ACTOR_ROLE_LABELS,
  AssetKind,
  ASSET_KIND_LABELS,
  AuctionState,
  AUCTION_STATE_LABELS,
  Bytes32Schema,
  ClaimState,
  CLAIM_STATE_LABELS,
  DealState,
  DEAL_STATE_LABELS,
  DisputeState,
  DISPUTE_STATE_LABELS,
  InvoiceListingState,
  INVOICE_LISTING_STATE_LABELS,
  KycLevel,
  KYC_LEVEL_LABELS,
  MarketListingStatus,
  MARKET_LISTING_STATUS_LABELS,
  OrderSide,
  ORDER_SIDE_LABELS,
  OrgType,
  ORG_TYPE_LABELS,
  PolicyState,
  POLICY_STATE_LABELS,
  RISK_GRADE_LABELS,
  type ActorProfile,
  type Auction,
  type Claim,
  type Dispute,
  type EsgRecord,
  type FinancingOffer,
  type Identity,
  type InvoiceListing,
  type KycStatus,
  type MarketListing,
  type Order,
  type Organization,
  type Policy,
  type ReceivableTerms,
  type Reputation,
  type RiskGrade,
} from "./types";

// ---------------------------------------------------------------------------
// Primitive coercions shared by the struct schemas
// ---------------------------------------------------------------------------

/**
 * Accepts a `bigint`, a safe integer, or a base-10 numeric string and yields a
 * `bigint`. Rejects negatives and non-integer numbers. Implemented with
 * `preprocess` so the resulting schema's output type is exactly `bigint`.
 */
const BigIntLike = z.preprocess((v) => {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isInteger(v)) return BigInt(v);
  if (typeof v === "string" && /^\d+$/u.test(v)) return BigInt(v);
  return v; // leave malformed input for z.bigint() to reject
}, z.bigint().nonnegative("Value must be non-negative"));

/** Bounded unsigned integer read back as a JS `number` (uint8/uint16). */
function uintNumber(bits: number): z.ZodType<number> {
  const max = 2 ** bits - 1;
  return z
    .number()
    .int("Expected an integer")
    .min(0, "Value must be >= 0")
    .max(max, `Value must be <= ${max} (uint${bits})`) as z.ZodType<number>;
}

const Uint8 = uintNumber(8);
const Uint16 = uintNumber(16);

/**
 * Validate that `value` is a member of a numeric enum's value set. Returns the
 * value typed as `T`; throws {@link ValidationError} otherwise.
 */
export function decodeEnum<T extends number>(
  label: string,
  allowed: readonly T[],
  value: unknown,
): T {
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    (allowed as readonly number[]).includes(value)
  ) {
    return value as T;
  }
  throw new ValidationError(`Invalid ${label} enum value`, {
    value,
    allowed,
  });
}

/**
 * Parse `raw` with `schema`, re-wrapping any Zod failure as a structured
 * {@link ValidationError} carrying the flattened issues.
 *
 * Generic over the schema (not its output) so transform/preprocess schemas keep
 * their real output type — e.g. `AddressSchema` yields `` `0x${string}` `` here,
 * not the pre-transform `string`.
 */
function parse<S extends z.ZodTypeAny>(
  schema: S,
  raw: unknown,
  label: string,
): z.infer<S> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError(`Invalid ${label}`, result.error.flatten());
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Identity decoders
// ---------------------------------------------------------------------------

const OrgTypeValues = [
  OrgType.Unknown,
  OrgType.Supplier,
  OrgType.Buyer,
  OrgType.Carrier,
  OrgType.Lender,
  OrgType.Insurer,
  OrgType.Other,
] as const;

const OrganizationSchema = z.object({
  orgId: Bytes32Schema,
  name: z.string(),
  orgType: z.number().int(),
  metadataURI: z.string(),
  admin: AddressSchema,
  createdAt: BigIntLike,
  exists: z.boolean(),
});

export function decodeOrganization(raw: unknown): Organization {
  const p = parse(OrganizationSchema, raw, "Organization");
  return Object.freeze({
    orgId: p.orgId as `0x${string}`,
    name: p.name,
    orgType: decodeEnum("OrgType", OrgTypeValues, p.orgType),
    metadataURI: p.metadataURI,
    admin: p.admin,
    createdAt: p.createdAt,
    exists: p.exists,
  });
}

const ActorProfileSchema = z.object({
  account: AddressSchema,
  name: z.string(),
  uri: z.string(),
  registeredAt: BigIntLike,
  exists: z.boolean(),
});

export function decodeActorProfile(raw: unknown): ActorProfile {
  const p = parse(ActorProfileSchema, raw, "ActorProfile");
  return Object.freeze({
    account: p.account,
    name: p.name,
    uri: p.uri,
    registeredAt: p.registeredAt,
    exists: p.exists,
  });
}

const KycLevelValues = [
  KycLevel.None,
  KycLevel.Basic,
  KycLevel.Verified,
  KycLevel.Enhanced,
] as const;

const KycStatusSchema = z.object({
  level: z.number().int(),
  updatedAt: BigIntLike,
  provider: AddressSchema,
});

export function decodeKycStatus(raw: unknown): KycStatus {
  const p = parse(KycStatusSchema, raw, "KycStatus");
  return Object.freeze({
    level: decodeEnum("KycLevel", KycLevelValues, p.level),
    updatedAt: p.updatedAt,
    provider: p.provider,
  });
}

const ActorRoleValues = [
  ActorRole.Unknown,
  ActorRole.Supplier,
  ActorRole.Buyer,
  ActorRole.Carrier,
] as const;

const IdentitySchema = z.object({
  role: z.number().int(),
  orgId: Bytes32Schema,
  name: z.string(),
});

export function decodeIdentity(raw: unknown): Identity {
  const p = parse(IdentitySchema, raw, "Identity");
  return Object.freeze({
    role: decodeEnum("ActorRole", ActorRoleValues, p.role),
    orgId: p.orgId as `0x${string}`,
    name: p.name,
  });
}

// ---------------------------------------------------------------------------
// Reputation decoders
// ---------------------------------------------------------------------------

/**
 * `reputationOf` returns four values. Depending on the viem version / ABI this
 * comes back either as a positional tuple `[avg, deals, pass, disputes]` or a
 * named object. Accept both.
 */
const ReputationTupleSchema = z.tuple([Uint16, BigIntLike, Uint16, BigIntLike]);
const ReputationObjectSchema = z.object({
  avgScoreBps: Uint16,
  totalDeals: BigIntLike,
  passRateBps: Uint16,
  disputes: BigIntLike,
});

export function decodeReputation(raw: unknown): Reputation {
  if (Array.isArray(raw)) {
    const [avgScoreBps, totalDeals, passRateBps, disputes] = parse(
      ReputationTupleSchema,
      raw,
      "Reputation",
    );
    return Object.freeze({ avgScoreBps, totalDeals, passRateBps, disputes });
  }
  const p = parse(ReputationObjectSchema, raw, "Reputation");
  return Object.freeze({
    avgScoreBps: p.avgScoreBps,
    totalDeals: p.totalDeals,
    passRateBps: p.passRateBps,
    disputes: p.disputes,
  });
}

// ---------------------------------------------------------------------------
// Finance decoders
// ---------------------------------------------------------------------------

const ReceivableTermsSchema = z.object({
  batchId: Bytes32Schema,
  faceValue: BigIntLike,
  dueDate: BigIntLike,
  obligor: AddressSchema,
  token: AddressSchema,
  exists: z.boolean(),
});

export function decodeReceivableTerms(raw: unknown): ReceivableTerms {
  const p = parse(ReceivableTermsSchema, raw, "ReceivableTerms");
  return Object.freeze({
    batchId: p.batchId as `0x${string}`,
    faceValue: p.faceValue,
    dueDate: p.dueDate,
    obligor: p.obligor,
    token: p.token,
    exists: p.exists,
  });
}

const InvoiceListingStateValues = [
  InvoiceListingState.None,
  InvoiceListingState.Listed,
  InvoiceListingState.Funded,
  InvoiceListingState.Claimed,
  InvoiceListingState.Cancelled,
] as const;

const InvoiceListingSchema = z.object({
  batchId: Bytes32Schema,
  supplier: AddressSchema,
  lender: AddressSchema,
  token: AddressSchema,
  askAmount: BigIntLike,
  state: z.number().int(),
});

export function decodeInvoiceListing(raw: unknown): InvoiceListing {
  const p = parse(InvoiceListingSchema, raw, "InvoiceListing");
  return Object.freeze({
    batchId: p.batchId as `0x${string}`,
    supplier: p.supplier,
    lender: p.lender,
    token: p.token,
    askAmount: p.askAmount,
    state: decodeEnum(
      "InvoiceListingState",
      InvoiceListingStateValues,
      p.state,
    ),
  });
}

// ---------------------------------------------------------------------------
// Insurance decoders
// ---------------------------------------------------------------------------

const PolicyStateValues = [
  PolicyState.None,
  PolicyState.Active,
  PolicyState.Claimed,
  PolicyState.Expired,
  PolicyState.Cancelled,
] as const;

const PolicySchema = z.object({
  policyId: Bytes32Schema,
  batchId: Bytes32Schema,
  holder: AddressSchema,
  token: AddressSchema,
  coverage: BigIntLike,
  premium: BigIntLike,
  issuedAt: BigIntLike,
  state: z.number().int(),
});

export function decodePolicy(raw: unknown): Policy {
  const p = parse(PolicySchema, raw, "Policy");
  return Object.freeze({
    policyId: p.policyId as `0x${string}`,
    batchId: p.batchId as `0x${string}`,
    holder: p.holder,
    token: p.token,
    coverage: p.coverage,
    premium: p.premium,
    issuedAt: p.issuedAt,
    state: decodeEnum("PolicyState", PolicyStateValues, p.state),
  });
}

const ClaimStateValues = [
  ClaimState.None,
  ClaimState.Filed,
  ClaimState.Approved,
  ClaimState.Rejected,
  ClaimState.Paid,
] as const;

const ClaimSchema = z.object({
  claimId: Bytes32Schema,
  policyId: Bytes32Schema,
  claimant: AddressSchema,
  amount: BigIntLike,
  state: z.number().int(),
  filedAt: BigIntLike,
});

export function decodeClaim(raw: unknown): Claim {
  const p = parse(ClaimSchema, raw, "Claim");
  return Object.freeze({
    claimId: p.claimId as `0x${string}`,
    policyId: p.policyId as `0x${string}`,
    claimant: p.claimant,
    amount: p.amount,
    state: decodeEnum("ClaimState", ClaimStateValues, p.state),
    filedAt: p.filedAt,
  });
}

// ---------------------------------------------------------------------------
// Governance / dispute decoders
// ---------------------------------------------------------------------------

const DisputeStateValues = [
  DisputeState.None,
  DisputeState.Open,
  DisputeState.Resolved,
] as const;

const DisputeSchema = z.object({
  batchId: Bytes32Schema,
  openedAt: BigIntLike,
  votesRefund: BigIntLike,
  votesRelease: BigIntLike,
  state: z.number().int(),
  refundedBuyer: z.boolean(),
});

export function decodeDispute(raw: unknown): Dispute {
  const p = parse(DisputeSchema, raw, "Dispute");
  return Object.freeze({
    batchId: p.batchId as `0x${string}`,
    openedAt: p.openedAt,
    votesRefund: p.votesRefund,
    votesRelease: p.votesRelease,
    state: decodeEnum("DisputeState", DisputeStateValues, p.state),
    refundedBuyer: p.refundedBuyer,
  });
}

// ---------------------------------------------------------------------------
// ESG decoders
// ---------------------------------------------------------------------------

const EsgRecordSchema = z.object({
  subject: Bytes32Schema,
  score: Uint16,
  uri: z.string(),
  updatedAt: BigIntLike,
  attestor: AddressSchema,
  exists: z.boolean(),
});

export function decodeEsgRecord(raw: unknown): EsgRecord {
  const p = parse(EsgRecordSchema, raw, "EsgRecord");
  return Object.freeze({
    subject: p.subject as `0x${string}`,
    score: p.score,
    uri: p.uri,
    updatedAt: p.updatedAt,
    attestor: p.attestor,
    exists: p.exists,
  });
}

// ---------------------------------------------------------------------------
// Marketplace decoders
// ---------------------------------------------------------------------------

const AssetKindValues = [
  AssetKind.Unknown,
  AssetKind.Receivable,
  AssetKind.ERC721,
  AssetKind.ERC1155,
] as const;

const MarketListingStatusValues = [
  MarketListingStatus.None,
  MarketListingStatus.Active,
  MarketListingStatus.Cancelled,
  MarketListingStatus.Filled,
] as const;

const MarketListingSchema = z.object({
  listingId: BigIntLike,
  kind: z.number().int(),
  asset: AddressSchema,
  assetId: BigIntLike,
  amount: BigIntLike,
  seller: AddressSchema,
  paymentToken: AddressSchema,
  price: BigIntLike,
  status: z.number().int(),
});

export function decodeMarketListing(raw: unknown): MarketListing {
  const p = parse(MarketListingSchema, raw, "MarketListing");
  return Object.freeze({
    listingId: p.listingId,
    kind: decodeEnum("AssetKind", AssetKindValues, p.kind),
    asset: p.asset,
    assetId: p.assetId,
    amount: p.amount,
    seller: p.seller,
    paymentToken: p.paymentToken,
    price: p.price,
    status: decodeEnum(
      "MarketListingStatus",
      MarketListingStatusValues,
      p.status,
    ),
  });
}

const FinancingOfferSchema = z.object({
  offerId: BigIntLike,
  batchId: Bytes32Schema,
  maker: AddressSchema,
  token: AddressSchema,
  amount: BigIntLike,
  taken: z.boolean(),
  cancelled: z.boolean(),
});

export function decodeFinancingOffer(raw: unknown): FinancingOffer {
  const p = parse(FinancingOfferSchema, raw, "FinancingOffer");
  return Object.freeze({
    offerId: p.offerId,
    batchId: p.batchId as `0x${string}`,
    maker: p.maker,
    token: p.token,
    amount: p.amount,
    taken: p.taken,
    cancelled: p.cancelled,
  });
}

const AuctionStateValues = [
  AuctionState.None,
  AuctionState.Active,
  AuctionState.Settled,
  AuctionState.Cancelled,
] as const;

const AuctionSchema = z.object({
  auctionId: BigIntLike,
  nft: AddressSchema,
  tokenId: BigIntLike,
  seller: AddressSchema,
  paymentToken: AddressSchema,
  reservePrice: BigIntLike,
  highestBid: BigIntLike,
  highestBidder: AddressSchema,
  endTime: BigIntLike,
  state: z.number().int(),
});

export function decodeAuction(raw: unknown): Auction {
  const p = parse(AuctionSchema, raw, "Auction");
  return Object.freeze({
    auctionId: p.auctionId,
    nft: p.nft,
    tokenId: p.tokenId,
    seller: p.seller,
    paymentToken: p.paymentToken,
    reservePrice: p.reservePrice,
    highestBid: p.highestBid,
    highestBidder: p.highestBidder,
    endTime: p.endTime,
    state: decodeEnum("AuctionState", AuctionStateValues, p.state),
  });
}

const OrderSideValues = [OrderSide.Buy, OrderSide.Sell] as const;

const OrderSchema = z.object({
  orderId: BigIntLike,
  side: z.number().int(),
  asset: AddressSchema,
  assetId: BigIntLike,
  paymentToken: AddressSchema,
  price: BigIntLike,
  quantity: BigIntLike,
  filled: BigIntLike,
  maker: AddressSchema,
  cancelled: z.boolean(),
});

export function decodeOrder(raw: unknown): Order {
  const p = parse(OrderSchema, raw, "Order");
  return Object.freeze({
    orderId: p.orderId,
    side: decodeEnum("OrderSide", OrderSideValues, p.side),
    asset: p.asset,
    assetId: p.assetId,
    paymentToken: p.paymentToken,
    price: p.price,
    quantity: p.quantity,
    filled: p.filled,
    maker: p.maker,
    cancelled: p.cancelled,
  });
}

// ---------------------------------------------------------------------------
// TokenInfo (StablecoinRegistry) decoder — decimals is uint8
// ---------------------------------------------------------------------------

const TokenInfoSchema = z.object({
  token: AddressSchema,
  decimals: Uint8,
  accepted: z.boolean(),
});

export function decodeTokenInfo(
  raw: unknown,
): { readonly token: `0x${string}`; readonly decimals: number; readonly accepted: boolean } {
  const p = parse(TokenInfoSchema, raw, "TokenInfo");
  return Object.freeze({
    token: p.token,
    decimals: p.decimals,
    accepted: p.accepted,
  });
}

// ---------------------------------------------------------------------------
// Numeric helpers
// ---------------------------------------------------------------------------

/** Convert a basis-points value (0..10000) to a percentage number (0..100). */
export function bpsToPercent(bps: number): number {
  if (!Number.isFinite(bps)) {
    throw new ValidationError("bps must be a finite number", { bps });
  }
  return (bps / 10000) * 100;
}

/** True when `score` meets or exceeds `threshold` (both in bps). */
export function isPassingScore(score: number, threshold: number): boolean {
  return score >= threshold;
}

// ---------------------------------------------------------------------------
// Label helpers (safe lookups with an explicit fallback)
// ---------------------------------------------------------------------------

function labelFor(
  map: Readonly<Record<number, string>>,
  value: number,
  fallback = "Unknown",
): string {
  return map[value] ?? fallback;
}

export const dealStateLabel = (s: DealState): string =>
  labelFor(DEAL_STATE_LABELS, s);
export const orgTypeLabel = (t: OrgType): string => labelFor(ORG_TYPE_LABELS, t);
export const kycLevelLabel = (l: KycLevel): string =>
  labelFor(KYC_LEVEL_LABELS, l);
export const actorRoleLabel = (r: ActorRole): string =>
  labelFor(ACTOR_ROLE_LABELS, r);
export const invoiceListingStateLabel = (s: InvoiceListingState): string =>
  labelFor(INVOICE_LISTING_STATE_LABELS, s);
export const policyStateLabel = (s: PolicyState): string =>
  labelFor(POLICY_STATE_LABELS, s);
export const claimStateLabel = (s: ClaimState): string =>
  labelFor(CLAIM_STATE_LABELS, s);
export const disputeStateLabel = (s: DisputeState): string =>
  labelFor(DISPUTE_STATE_LABELS, s);
export const assetKindLabel = (k: AssetKind): string =>
  labelFor(ASSET_KIND_LABELS, k);
export const marketListingStatusLabel = (s: MarketListingStatus): string =>
  labelFor(MARKET_LISTING_STATUS_LABELS, s);
export const auctionStateLabel = (s: AuctionState): string =>
  labelFor(AUCTION_STATE_LABELS, s);
export const orderSideLabel = (s: OrderSide): string =>
  labelFor(ORDER_SIDE_LABELS, s);

/** Label for a composite risk grade (0 = ungraded, 1 best .. 7 worst). */
export function riskGradeLabel(grade: RiskGrade): string {
  return RISK_GRADE_LABELS[grade] ?? "Unknown";
}
