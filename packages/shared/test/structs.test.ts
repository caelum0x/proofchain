import { describe, expect, it } from "vitest";

import { ValidationError } from "../src/errors";
import {
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
} from "../src/structs";
import {
  ActorRole,
  AssetKind,
  AuctionState,
  ClaimState,
  DealState,
  DisputeState,
  InvoiceListingState,
  KycLevel,
  MarketListingStatus,
  OrderSide,
  OrgType,
  PolicyState,
} from "../src/types";

const ADDR_A = "0x1111111111111111111111111111111111111111";
const ADDR_B = "0x2222222222222222222222222222222222222222";
const ADDR_C = "0x3333333333333333333333333333333333333333";
const B32 = `0x${"aa".repeat(32)}`;
const B32_B = `0x${"bb".repeat(32)}`;

describe("decodeEnum", () => {
  it("accepts an in-range value", () => {
    expect(decodeEnum("X", [0, 1, 2], 2)).toBe(2);
  });

  it("rejects an out-of-range or non-integer value", () => {
    expect(() => decodeEnum("X", [0, 1], 5)).toThrow(ValidationError);
    expect(() => decodeEnum("X", [0, 1], 1.5)).toThrow(ValidationError);
    expect(() => decodeEnum("X", [0, 1], "1")).toThrow(ValidationError);
  });
});

describe("decodeOrganization", () => {
  const raw = {
    orgId: B32,
    name: "Acme",
    orgType: 1,
    metadataURI: "ipfs://org",
    admin: ADDR_A,
    createdAt: 1_700_000_000n,
    exists: true,
  };

  it("normalizes a valid struct and freezes it", () => {
    const org = decodeOrganization(raw);
    expect(org.orgType).toBe(OrgType.Supplier);
    expect(org.createdAt).toBe(1_700_000_000n);
    expect(org.admin).toBe(ADDR_A);
    expect(Object.isFrozen(org)).toBe(true);
  });

  it("accepts a numeric-string createdAt (JSON relay)", () => {
    const org = decodeOrganization({ ...raw, createdAt: "1700000000" });
    expect(org.createdAt).toBe(1_700_000_000n);
  });

  it("rejects an out-of-range orgType", () => {
    expect(() => decodeOrganization({ ...raw, orgType: 99 })).toThrow(
      ValidationError,
    );
  });

  it("rejects a malformed admin address", () => {
    expect(() => decodeOrganization({ ...raw, admin: "0xdead" })).toThrow(
      ValidationError,
    );
  });

  it("rejects a negative createdAt", () => {
    expect(() => decodeOrganization({ ...raw, createdAt: -1n })).toThrow(
      ValidationError,
    );
  });
});

describe("decodeActorProfile", () => {
  it("decodes a supplier/buyer/carrier profile", () => {
    const p = decodeActorProfile({
      account: ADDR_B,
      name: "Widgets Ltd",
      uri: "ipfs://s",
      registeredAt: 100n,
      exists: true,
    });
    expect(p.account).toBe(ADDR_B);
    expect(p.registeredAt).toBe(100n);
  });
});

describe("decodeKycStatus", () => {
  it("decodes and maps the level enum", () => {
    const k = decodeKycStatus({ level: 2, updatedAt: 5n, provider: ADDR_A });
    expect(k.level).toBe(KycLevel.Verified);
  });

  it("rejects an invalid level", () => {
    expect(() =>
      decodeKycStatus({ level: 7, updatedAt: 5n, provider: ADDR_A }),
    ).toThrow(ValidationError);
  });
});

describe("decodeIdentity", () => {
  it("resolves role/org/name", () => {
    const id = decodeIdentity({ role: 3, orgId: B32, name: "DHL" });
    expect(id.role).toBe(ActorRole.Carrier);
    expect(id.name).toBe("DHL");
  });
});

describe("decodeReputation", () => {
  it("decodes a positional tuple", () => {
    const r = decodeReputation([9000, 12n, 8500, 1n]);
    expect(r).toEqual({
      avgScoreBps: 9000,
      totalDeals: 12n,
      passRateBps: 8500,
      disputes: 1n,
    });
  });

  it("decodes a named object", () => {
    const r = decodeReputation({
      avgScoreBps: 9000,
      totalDeals: 12n,
      passRateBps: 8500,
      disputes: 1n,
    });
    expect(r.avgScoreBps).toBe(9000);
    expect(r.totalDeals).toBe(12n);
  });

  it("rejects an out-of-range bps in a tuple", () => {
    expect(() => decodeReputation([70000, 0n, 0, 0n])).toThrow(ValidationError);
  });
});

describe("decodeReceivableTerms", () => {
  it("decodes face value + due date", () => {
    const t = decodeReceivableTerms({
      batchId: B32,
      faceValue: 1_000_000n,
      dueDate: 1_800_000_000n,
      obligor: ADDR_A,
      token: ADDR_B,
      exists: true,
    });
    expect(t.faceValue).toBe(1_000_000n);
    expect(t.obligor).toBe(ADDR_A);
  });
});

describe("decodeInvoiceListing", () => {
  it("decodes and maps the listing state", () => {
    const l = decodeInvoiceListing({
      batchId: B32,
      supplier: ADDR_A,
      lender: ADDR_B,
      token: ADDR_C,
      askAmount: 900_000n,
      state: 2,
    });
    expect(l.state).toBe(InvoiceListingState.Funded);
    expect(l.askAmount).toBe(900_000n);
  });
});

describe("decodePolicy / decodeClaim", () => {
  it("decodes a policy", () => {
    const p = decodePolicy({
      policyId: B32,
      batchId: B32_B,
      holder: ADDR_A,
      token: ADDR_B,
      coverage: 500_000n,
      premium: 5_000n,
      issuedAt: 10n,
      state: 1,
    });
    expect(p.state).toBe(PolicyState.Active);
    expect(p.coverage).toBe(500_000n);
  });

  it("decodes a claim", () => {
    const c = decodeClaim({
      claimId: B32,
      policyId: B32_B,
      claimant: ADDR_A,
      amount: 250_000n,
      state: 2,
      filedAt: 11n,
    });
    expect(c.state).toBe(ClaimState.Approved);
  });
});

describe("decodeDispute", () => {
  it("decodes vote tallies", () => {
    const d = decodeDispute({
      batchId: B32,
      openedAt: 20n,
      votesRefund: 3n,
      votesRelease: 5n,
      state: 1,
      refundedBuyer: false,
    });
    expect(d.state).toBe(DisputeState.Open);
    expect(d.votesRelease).toBe(5n);
  });
});

describe("decodeEsgRecord", () => {
  it("decodes an ESG record", () => {
    const e = decodeEsgRecord({
      subject: B32,
      score: 7200,
      uri: "ipfs://esg",
      updatedAt: 30n,
      attestor: ADDR_A,
      exists: true,
    });
    expect(e.score).toBe(7200);
  });

  it("rejects a uint16-overflow score", () => {
    expect(() =>
      decodeEsgRecord({
        subject: B32,
        score: 70000,
        uri: "ipfs://esg",
        updatedAt: 30n,
        attestor: ADDR_A,
        exists: true,
      }),
    ).toThrow(ValidationError);
  });
});

describe("marketplace decoders", () => {
  it("decodes a market listing", () => {
    const l = decodeMarketListing({
      listingId: 1n,
      kind: 2,
      asset: ADDR_A,
      assetId: 42n,
      amount: 1n,
      seller: ADDR_B,
      paymentToken: ADDR_C,
      price: 1_000n,
      status: 1,
    });
    expect(l.kind).toBe(AssetKind.ERC721);
    expect(l.status).toBe(MarketListingStatus.Active);
  });

  it("decodes a financing offer", () => {
    const o = decodeFinancingOffer({
      offerId: 7n,
      batchId: B32,
      maker: ADDR_A,
      token: ADDR_B,
      amount: 800_000n,
      taken: false,
      cancelled: false,
    });
    expect(o.offerId).toBe(7n);
  });

  it("decodes an auction", () => {
    const a = decodeAuction({
      auctionId: 3n,
      nft: ADDR_A,
      tokenId: 99n,
      seller: ADDR_B,
      paymentToken: ADDR_C,
      reservePrice: 10n,
      highestBid: 15n,
      highestBidder: ADDR_A,
      endTime: 1_900_000_000n,
      state: 1,
    });
    expect(a.state).toBe(AuctionState.Active);
    expect(a.highestBid).toBe(15n);
  });

  it("decodes an order and its side", () => {
    const o = decodeOrder({
      orderId: 5n,
      side: 1,
      asset: ADDR_A,
      assetId: 0n,
      paymentToken: ADDR_B,
      price: 100n,
      quantity: 10n,
      filled: 2n,
      maker: ADDR_C,
      cancelled: false,
    });
    expect(o.side).toBe(OrderSide.Sell);
  });
});

describe("decodeTokenInfo", () => {
  it("decodes a uint8 decimals field", () => {
    const t = decodeTokenInfo({ token: ADDR_A, decimals: 6, accepted: true });
    expect(t.decimals).toBe(6);
    expect(t.accepted).toBe(true);
  });

  it("rejects decimals above uint8 range", () => {
    expect(() =>
      decodeTokenInfo({ token: ADDR_A, decimals: 256, accepted: true }),
    ).toThrow(ValidationError);
  });
});

describe("numeric helpers", () => {
  it("bpsToPercent converts basis points to percent", () => {
    expect(bpsToPercent(0)).toBe(0);
    expect(bpsToPercent(7000)).toBe(70);
    expect(bpsToPercent(10000)).toBe(100);
  });

  it("bpsToPercent rejects non-finite input", () => {
    expect(() => bpsToPercent(Number.NaN)).toThrow(ValidationError);
  });

  it("isPassingScore compares score vs threshold", () => {
    expect(isPassingScore(7000, 7000)).toBe(true);
    expect(isPassingScore(6999, 7000)).toBe(false);
  });
});

describe("label helpers", () => {
  it("map known enum values to labels", () => {
    expect(dealStateLabel(DealState.Released)).toBe("Released");
    expect(orgTypeLabel(OrgType.Insurer)).toBe("Insurer");
    expect(kycLevelLabel(KycLevel.Enhanced)).toBe("Enhanced");
    expect(actorRoleLabel(ActorRole.Buyer)).toBe("Buyer");
    expect(invoiceListingStateLabel(InvoiceListingState.Claimed)).toBe(
      "Claimed",
    );
    expect(policyStateLabel(PolicyState.Expired)).toBe("Expired");
    expect(claimStateLabel(ClaimState.Paid)).toBe("Paid");
    expect(disputeStateLabel(DisputeState.Resolved)).toBe("Resolved");
    expect(assetKindLabel(AssetKind.ERC1155)).toBe("ERC1155");
    expect(marketListingStatusLabel(MarketListingStatus.Filled)).toBe("Filled");
    expect(auctionStateLabel(AuctionState.Settled)).toBe("Settled");
    expect(orderSideLabel(OrderSide.Buy)).toBe("Buy");
  });

  it("riskGradeLabel maps grades and falls back for unknowns", () => {
    expect(riskGradeLabel(0)).toBe("Ungraded");
    expect(riskGradeLabel(1)).toBe("A+");
    expect(riskGradeLabel(7)).toBe("F");
    expect(riskGradeLabel(99)).toBe("Unknown");
  });
});
