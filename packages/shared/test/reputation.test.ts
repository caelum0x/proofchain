import { describe, expect, it } from "vitest";

import {
  decodeBondMovement,
  decodeGradeParamsUpdated,
  decodeOutcomeRecorded,
  decodeReputationEvent,
  decodeSlashed,
  decodeStakeSlashed,
} from "../src/decoders/reputation";
import { ValidationError } from "../src/errors";
import {
  ADDR_A,
  ADDR_B,
  ADDR_C,
  REASON,
  BondDepositedEvent,
  GradeParamsUpdatedEvent,
  OutcomeRecordedEvent,
  SlashedEvent,
  StakeSlashedEvent,
  buildLog,
} from "./domain-fixtures";

describe("decodeOutcomeRecorded", () => {
  it("decodes bool + uint16 fields with correct JS types", () => {
    const log = buildLog(OutcomeRecordedEvent, {
      supplier: ADDR_A,
      passed: true,
      score: 8800n,
      newAvgScoreBps: 9100n,
    });
    const args = decodeOutcomeRecorded(log);
    expect(args).toEqual({
      supplier: ADDR_A,
      passed: true,
      score: 8800,
      newAvgScoreBps: 9100,
    });
    expect(typeof args?.score).toBe("number");
    expect(typeof args?.passed).toBe("boolean");
  });

  it("returns null for a non-matching log", () => {
    const log = buildLog(GradeParamsUpdatedEvent, {
      reputationWeightBps: 6000n,
      kycWeightBps: 4000n,
    });
    expect(decodeOutcomeRecorded(log)).toBeNull();
  });
});

describe("decodeGradeParamsUpdated", () => {
  it("narrows both weight fields to numbers", () => {
    const log = buildLog(GradeParamsUpdatedEvent, {
      reputationWeightBps: 6000n,
      kycWeightBps: 4000n,
    });
    const args = decodeGradeParamsUpdated(log);
    expect(args).toEqual({ reputationWeightBps: 6000, kycWeightBps: 4000 });
  });
});

describe("decodeSlashed", () => {
  it("keeps the uint256 amount as a bigint and decodes the reason", () => {
    const log = buildLog(SlashedEvent, {
      who: ADDR_A,
      amount: 1_000_000_000_000_000_000n,
      reason: REASON,
      to: ADDR_B,
    });
    const args = decodeSlashed(log);
    expect(args?.amount).toBe(1_000_000_000_000_000_000n);
    expect(args?.reason).toBe(REASON);
    expect(args?.to).toBe(ADDR_B);
  });
});

describe("decodeBondMovement", () => {
  it("decodes a BondDeposited log", () => {
    const log = buildLog(BondDepositedEvent, {
      supplier: ADDR_A,
      token: ADDR_C,
      amount: 500n,
    });
    const args = decodeBondMovement(log);
    expect(args).toEqual({ supplier: ADDR_A, token: ADDR_C, amount: 500n });
  });
});

describe("decodeStakeSlashed", () => {
  it("decodes the three-field StakeManager slash event", () => {
    const log = buildLog(StakeSlashedEvent, {
      account: ADDR_A,
      amount: 250n,
      to: ADDR_B,
    });
    const args = decodeStakeSlashed(log);
    expect(args).toEqual({ account: ADDR_A, amount: 250n, to: ADDR_B });
  });
});

describe("decodeReputationEvent", () => {
  it("routes an OutcomeRecorded log to ReputationEngine", () => {
    const log = buildLog(OutcomeRecordedEvent, {
      supplier: ADDR_A,
      passed: false,
      score: 4000n,
      newAvgScoreBps: 4200n,
    });
    const decoded = decodeReputationEvent(log);
    expect(decoded?.contract).toBe("ReputationEngine");
    expect(decoded?.eventName).toBe("OutcomeRecorded");
    if (decoded?.eventName === "OutcomeRecorded") {
      expect(decoded.args.passed).toBe(false);
    }
  });

  it("routes a Slashed log to SlashingController", () => {
    const log = buildLog(SlashedEvent, {
      who: ADDR_A,
      amount: 10n,
      reason: REASON,
      to: ADDR_B,
    });
    const decoded = decodeReputationEvent(log);
    expect(decoded?.contract).toBe("SlashingController");
    expect(decoded?.eventName).toBe("Slashed");
  });

  it("returns null for an unrecognized log", () => {
    expect(
      decodeReputationEvent({ topics: ["0x" + "cd".repeat(32)], data: "0x" }),
    ).toBeNull();
  });

  it("throws ValidationError on structurally invalid input", () => {
    expect(() =>
      decodeReputationEvent({ topics: "x", data: "0x" }),
    ).toThrow(ValidationError);
  });
});
