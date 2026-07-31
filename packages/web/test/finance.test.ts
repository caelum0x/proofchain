import { describe, expect, it } from "vitest";
import { InvoiceListingState } from "@proofchain/shared";
import type { Address, Hex } from "viem";
import {
  invoiceListingStateTone,
  isListingClosed,
  logOrder,
  navPerShare,
  openListings,
  reduceListingEvents,
  riskGradeTone,
  utilizationBps,
  type ListingEvent,
} from "@/lib/finance";

const BATCH_A = `0x${"a".repeat(64)}` as Hex;
const BATCH_B = `0x${"b".repeat(64)}` as Hex;
const SUP = `0x${"1".repeat(40)}` as Address;
const LENDER = `0x${"2".repeat(40)}` as Address;
const TOKEN = `0x${"3".repeat(40)}` as Address;

describe("invoiceListingStateTone", () => {
  it("maps each state to a tone", () => {
    expect(invoiceListingStateTone(InvoiceListingState.Listed)).toBe("brand");
    expect(invoiceListingStateTone(InvoiceListingState.Funded)).toBe("warn");
    expect(invoiceListingStateTone(InvoiceListingState.Claimed)).toBe("success");
    expect(invoiceListingStateTone(InvoiceListingState.Cancelled)).toBe("neutral");
    expect(invoiceListingStateTone(InvoiceListingState.None)).toBe("neutral");
  });
});

describe("riskGradeTone", () => {
  it("grades better = greener", () => {
    expect(riskGradeTone(0)).toBe("neutral");
    expect(riskGradeTone(1)).toBe("success");
    expect(riskGradeTone(2)).toBe("success");
    expect(riskGradeTone(3)).toBe("brand");
    expect(riskGradeTone(5)).toBe("warn");
    expect(riskGradeTone(7)).toBe("danger");
  });
});

describe("utilizationBps", () => {
  it("computes fraction deployed in bps", () => {
    expect(utilizationBps(0n, 0n)).toBe(0);
    expect(utilizationBps(0n, 100n)).toBe(0);
    expect(utilizationBps(50n, 100n)).toBe(5000);
    expect(utilizationBps(100n, 100n)).toBe(10000);
  });
  it("clamps over-deployment to 100%", () => {
    expect(utilizationBps(150n, 100n)).toBe(10000);
  });
});

describe("navPerShare", () => {
  it("is par when no shares", () => {
    expect(navPerShare(0n, 0n)).toBe(1);
    expect(navPerShare(1000n, 0n)).toBe(1);
  });
  it("reflects appreciation from repaid yield", () => {
    expect(navPerShare(1_100_000n, 1_000_000n)).toBeCloseTo(1.1, 6);
    expect(navPerShare(1_000_000n, 1_000_000n)).toBe(1);
  });
});

describe("logOrder", () => {
  it("orders by block then log index", () => {
    expect(logOrder(1n, 0)).toBeLessThan(logOrder(1n, 5));
    expect(logOrder(1n, 999) < logOrder(2n, 0)).toBe(true);
    expect(logOrder(undefined, undefined)).toBe(0n);
  });
});

describe("reduceListingEvents", () => {
  const listed: ListingEvent = {
    kind: "listed",
    batchId: BATCH_A,
    order: logOrder(1n, 0),
    supplier: SUP,
    token: TOKEN,
    askAmount: 1000n,
  };

  it("derives Listed from a lone list event", () => {
    const [rec] = reduceListingEvents([listed]);
    expect(rec.state).toBe(InvoiceListingState.Listed);
    expect(rec.supplier).toBe(SUP);
    expect(rec.askAmount).toBe(1000n);
  });

  it("advances to Funded and captures the lender", () => {
    const funded: ListingEvent = { kind: "funded", batchId: BATCH_A, order: logOrder(2n, 0), lender: LENDER };
    const [rec] = reduceListingEvents([listed, funded]);
    expect(rec.state).toBe(InvoiceListingState.Funded);
    expect(rec.lender).toBe(LENDER);
    expect(rec.askAmount).toBe(1000n);
  });

  it("applies events in order regardless of input order", () => {
    const funded: ListingEvent = { kind: "funded", batchId: BATCH_A, order: logOrder(2n, 0), lender: LENDER };
    const claimed: ListingEvent = { kind: "claimed", batchId: BATCH_A, order: logOrder(3n, 0) };
    const [rec] = reduceListingEvents([claimed, listed, funded]);
    expect(rec.state).toBe(InvoiceListingState.Claimed);
  });

  it("ignores orphan events with no prior listing", () => {
    const orphan: ListingEvent = { kind: "funded", batchId: BATCH_B, order: logOrder(1n, 0), lender: LENDER };
    expect(reduceListingEvents([orphan])).toHaveLength(0);
  });

  it("supports re-listing after cancellation", () => {
    const cancelled: ListingEvent = { kind: "cancelled", batchId: BATCH_A, order: logOrder(2n, 0) };
    const relisted: ListingEvent = { ...listed, order: logOrder(3n, 0), askAmount: 500n };
    const [rec] = reduceListingEvents([listed, cancelled, relisted]);
    expect(rec.state).toBe(InvoiceListingState.Listed);
    expect(rec.askAmount).toBe(500n);
  });

  it("returns records most-recent first", () => {
    const listedB: ListingEvent = { ...listed, batchId: BATCH_B, order: logOrder(5n, 0) };
    const recs = reduceListingEvents([listed, listedB]);
    expect(recs[0].batchId).toBe(BATCH_B);
  });
});

describe("openListings / isListingClosed", () => {
  it("filters to fundable listings", () => {
    const recs = reduceListingEvents([
      { kind: "listed", batchId: BATCH_A, order: logOrder(1n, 0), supplier: SUP, token: TOKEN, askAmount: 1n },
      { kind: "listed", batchId: BATCH_B, order: logOrder(2n, 0), supplier: SUP, token: TOKEN, askAmount: 1n },
      { kind: "cancelled", batchId: BATCH_B, order: logOrder(3n, 0) },
    ]);
    const open = openListings(recs);
    expect(open).toHaveLength(1);
    expect(open[0].batchId).toBe(BATCH_A);
  });
  it("flags terminal states as closed", () => {
    expect(isListingClosed(InvoiceListingState.Claimed)).toBe(true);
    expect(isListingClosed(InvoiceListingState.Cancelled)).toBe(true);
    expect(isListingClosed(InvoiceListingState.Listed)).toBe(false);
    expect(isListingClosed(InvoiceListingState.Funded)).toBe(false);
  });
});
