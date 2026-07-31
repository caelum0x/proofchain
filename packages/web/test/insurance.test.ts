import { describe, expect, it } from "vitest";
import { ClaimState, PolicyState } from "@proofchain/shared";
import type { Address, Hex } from "viem";
import { logOrder } from "@/lib/finance";
import {
  claimStateTone,
  payableClaims,
  pendingClaims,
  policyStateTone,
  reduceClaimEvents,
  reducePolicyEvents,
  reservedRatioBps,
  type ClaimEvent,
  type PolicyEvent,
} from "@/lib/insurance";

const POLICY_A = `0x${"a".repeat(64)}` as Hex;
const CLAIM_A = `0x${"c".repeat(64)}` as Hex;
const CLAIM_B = `0x${"d".repeat(64)}` as Hex;
const HOLDER = `0x${"1".repeat(40)}` as Address;

describe("policyStateTone / claimStateTone", () => {
  it("maps policy states", () => {
    expect(policyStateTone(PolicyState.Active)).toBe("success");
    expect(policyStateTone(PolicyState.Claimed)).toBe("brand");
    expect(policyStateTone(PolicyState.Cancelled)).toBe("neutral");
  });
  it("maps claim states", () => {
    expect(claimStateTone(ClaimState.Filed)).toBe("warn");
    expect(claimStateTone(ClaimState.Approved)).toBe("brand");
    expect(claimStateTone(ClaimState.Paid)).toBe("success");
    expect(claimStateTone(ClaimState.Rejected)).toBe("danger");
  });
});

describe("reservedRatioBps", () => {
  it("computes reserved fraction in bps and clamps", () => {
    expect(reservedRatioBps(0n, 0n)).toBe(0);
    expect(reservedRatioBps(25n, 100n)).toBe(2500);
    expect(reservedRatioBps(200n, 100n)).toBe(10000);
  });
});

describe("reducePolicyEvents", () => {
  const issued: PolicyEvent = {
    kind: "issued",
    policyId: POLICY_A,
    order: logOrder(1n, 0),
    holder: HOLDER,
    coverage: 1000n,
    premium: 50n,
  };
  it("derives Active from issuance", () => {
    const [rec] = reducePolicyEvents([issued]);
    expect(rec.state).toBe(PolicyState.Active);
    expect(rec.coverage).toBe(1000n);
    expect(rec.holder).toBe(HOLDER);
  });
  it("marks cancelled policies", () => {
    const cancelled: PolicyEvent = { kind: "cancelled", policyId: POLICY_A, order: logOrder(2n, 0) };
    const [rec] = reducePolicyEvents([cancelled, issued]);
    expect(rec.state).toBe(PolicyState.Cancelled);
    expect(rec.coverage).toBe(1000n);
  });
  it("ignores cancellation with no prior issuance", () => {
    const cancelled: PolicyEvent = { kind: "cancelled", policyId: POLICY_A, order: logOrder(1n, 0) };
    expect(reducePolicyEvents([cancelled])).toHaveLength(0);
  });
});

describe("reduceClaimEvents", () => {
  const filed: ClaimEvent = {
    kind: "filed",
    claimId: CLAIM_A,
    order: logOrder(1n, 0),
    policyId: POLICY_A,
    claimant: HOLDER,
    amount: 500n,
  };
  it("progresses filed → approved → paid", () => {
    const approved: ClaimEvent = { kind: "approved", claimId: CLAIM_A, order: logOrder(2n, 0) };
    const paid: ClaimEvent = { kind: "paid", claimId: CLAIM_A, order: logOrder(3n, 0) };
    const [rec] = reduceClaimEvents([filed, approved, paid]);
    expect(rec.state).toBe(ClaimState.Paid);
    expect(rec.amount).toBe(500n);
  });
  it("handles rejection", () => {
    const rejected: ClaimEvent = { kind: "rejected", claimId: CLAIM_A, order: logOrder(2n, 0) };
    const [rec] = reduceClaimEvents([filed, rejected]);
    expect(rec.state).toBe(ClaimState.Rejected);
  });
  it("filters pending and payable claims", () => {
    const filedB: ClaimEvent = { ...filed, claimId: CLAIM_B, order: logOrder(2n, 0) };
    const approvedB: ClaimEvent = { kind: "approved", claimId: CLAIM_B, order: logOrder(3n, 0) };
    const recs = reduceClaimEvents([filed, filedB, approvedB]);
    expect(pendingClaims(recs).map((r) => r.claimId)).toEqual([CLAIM_A]);
    expect(payableClaims(recs).map((r) => r.claimId)).toEqual([CLAIM_B]);
  });
});
