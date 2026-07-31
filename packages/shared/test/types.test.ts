import { describe, expect, it } from "vitest";

import {
  DEAL_STATE_LABELS,
  DealState,
  FindingSchema,
  ScoreBpsSchema,
  VerificationVerdictSchema,
  type VerificationVerdict,
} from "../src/types";

const BATCH_ID = "0x" + "aa".repeat(32);

function baseVerdict(overrides: Partial<VerificationVerdict> = {}): unknown {
  return {
    batchId: BATCH_ID,
    score: 9600,
    passed: true,
    threshold: 7000,
    findings: [],
    documentHashes: ["a".repeat(64)],
    createdAt: "2026-07-31T00:00:00.000Z",
    model: "claude-opus-4-8",
    ...overrides,
  };
}

describe("ScoreBpsSchema", () => {
  it("accepts values in [0, 10000]", () => {
    expect(ScoreBpsSchema.parse(0)).toBe(0);
    expect(ScoreBpsSchema.parse(10000)).toBe(10000);
  });

  it("rejects out-of-range and non-integer values", () => {
    expect(ScoreBpsSchema.safeParse(-1).success).toBe(false);
    expect(ScoreBpsSchema.safeParse(10001).success).toBe(false);
    expect(ScoreBpsSchema.safeParse(1.5).success).toBe(false);
  });
});

describe("FindingSchema", () => {
  it("validates a well-formed finding", () => {
    const finding = FindingSchema.parse({
      code: "INVOICE_TOTAL_MISMATCH",
      severity: "high",
      message: "Totals differ",
      evidence: { expected: 100, actual: 120 },
    });
    expect(finding.severity).toBe("high");
  });

  it("rejects an unknown severity", () => {
    expect(
      FindingSchema.safeParse({
        code: "X",
        severity: "fatal",
        message: "y",
      }).success,
    ).toBe(false);
  });

  it("rejects an empty code", () => {
    expect(
      FindingSchema.safeParse({ code: "", severity: "info", message: "y" })
        .success,
    ).toBe(false);
  });
});

describe("VerificationVerdictSchema", () => {
  it("accepts a consistent passing verdict", () => {
    const parsed = VerificationVerdictSchema.parse(baseVerdict());
    expect(parsed.passed).toBe(true);
  });

  it("accepts a consistent failing verdict", () => {
    const parsed = VerificationVerdictSchema.parse(
      baseVerdict({ score: 5000, passed: false }),
    );
    expect(parsed.passed).toBe(false);
  });

  it("rejects a verdict whose `passed` contradicts score vs threshold", () => {
    const result = VerificationVerdictSchema.safeParse(
      baseVerdict({ score: 5000, passed: true }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a malformed batchId", () => {
    expect(
      VerificationVerdictSchema.safeParse(baseVerdict({ batchId: "0x1234" }))
        .success,
    ).toBe(false);
  });

  it("rejects a non-ISO createdAt", () => {
    expect(
      VerificationVerdictSchema.safeParse(baseVerdict({ createdAt: "yesterday" }))
        .success,
    ).toBe(false);
  });
});

describe("DealState", () => {
  it("matches the Solidity enum ordering", () => {
    expect(DealState.None).toBe(0);
    expect(DealState.Funded).toBe(1);
    expect(DealState.Released).toBe(2);
    expect(DealState.Refunded).toBe(3);
    expect(DealState.Disputed).toBe(4);
  });

  it("has a label for every state", () => {
    expect(DEAL_STATE_LABELS[DealState.Disputed]).toBe("Disputed");
    expect(DEAL_STATE_LABELS[DealState.Funded]).toBe("Funded");
  });
});
