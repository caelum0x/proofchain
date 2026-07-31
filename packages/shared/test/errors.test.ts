import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  DecodeError,
  ErrorCode,
  ProofchainError,
  ValidationError,
  fail,
  ok,
  toErrorEnvelope,
} from "../src/errors";

describe("ProofchainError", () => {
  it("carries a code and serializes to an envelope", () => {
    const err = new ValidationError("bad input", { field: "x" });
    expect(err).toBeInstanceOf(ProofchainError);
    expect(err.code).toBe(ErrorCode.VALIDATION);
    expect(err.toEnvelope()).toEqual({
      code: ErrorCode.VALIDATION,
      message: "bad input",
      details: { field: "x" },
    });
  });

  it("omits details from the envelope when absent", () => {
    const err = new DecodeError("nope");
    expect(err.toEnvelope()).toEqual({
      code: ErrorCode.DECODE,
      message: "nope",
    });
  });

  it("preserves the underlying cause", () => {
    const cause = new Error("root");
    const err = new DecodeError("wrapper", { cause });
    expect(err.cause).toBe(cause);
  });
});

describe("toErrorEnvelope", () => {
  it("maps ProofchainError via its envelope", () => {
    const env = toErrorEnvelope(new ValidationError("v"));
    expect(env.code).toBe(ErrorCode.VALIDATION);
  });

  it("maps a ZodError to a validation envelope", () => {
    const schema = z.object({ n: z.number() });
    const parsed = schema.safeParse({ n: "x" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const env = toErrorEnvelope(parsed.error);
      expect(env.code).toBe(ErrorCode.VALIDATION);
      expect(env.details).toBeDefined();
    }
  });

  it("maps a plain Error to an unknown envelope", () => {
    const env = toErrorEnvelope(new Error("boom"));
    expect(env.code).toBe(ErrorCode.UNKNOWN);
    expect(env.message).toBe("boom");
  });

  it("maps a non-error value without throwing", () => {
    const env = toErrorEnvelope(42);
    expect(env.code).toBe(ErrorCode.UNKNOWN);
    expect(env.details).toBe(42);
  });
});

describe("Result helpers", () => {
  it("ok wraps data", () => {
    expect(ok(123)).toEqual({ success: true, data: 123, error: null });
  });

  it("fail wraps a thrown error into an envelope", () => {
    const result = fail(new ValidationError("v"));
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ErrorCode.VALIDATION);
  });

  it("fail passes through an existing envelope", () => {
    const envelope = { code: ErrorCode.DECODE, message: "d" };
    const result = fail(envelope);
    expect(result.error).toEqual(envelope);
  });
});
