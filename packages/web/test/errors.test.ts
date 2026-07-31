import { describe, expect, it } from "vitest";
import {
  AppError,
  contractErrorMessage,
  fail,
  getErrorMessage,
  ok,
  toEnvelope,
} from "@/lib/errors";

describe("envelopes", () => {
  it("wraps success", () => {
    expect(ok(42)).toEqual({ success: true, data: 42, error: null });
  });
  it("wraps failure", () => {
    const env = fail({ code: "X", message: "bad" });
    expect(env.success).toBe(false);
    expect(env.error).toEqual({ code: "X", message: "bad" });
  });
});

describe("AppError", () => {
  it("carries code and details", () => {
    const e = new AppError("CODE", "message", { details: "d" });
    expect(e.code).toBe("CODE");
    expect(e.toShape()).toEqual({ code: "CODE", message: "message", details: "d" });
  });
});

describe("getErrorMessage", () => {
  it("returns AppError message", () => {
    expect(getErrorMessage(new AppError("C", "boom"))).toBe("boom");
  });
  it("returns Error message", () => {
    expect(getErrorMessage(new Error("plain"))).toBe("plain");
  });
  it("returns strings verbatim", () => {
    expect(getErrorMessage("literal")).toBe("literal");
  });
  it("has a fallback for unknown", () => {
    expect(getErrorMessage(undefined)).toMatch(/unexpected/i);
  });
});

describe("contractErrorMessage", () => {
  it("maps known custom errors", () => {
    expect(contractErrorMessage("BatchExists")).toMatch(/already registered/i);
    expect(contractErrorMessage("ZeroAmount")).toMatch(/greater than zero/i);
    expect(contractErrorMessage("AlreadyAttested")).toMatch(/already been attested/i);
  });
  it("falls back for unknown errors", () => {
    expect(contractErrorMessage("Weird")).toMatch(/reverted: Weird/);
  });
});

describe("toEnvelope", () => {
  it("converts AppError", () => {
    const env = toEnvelope(new AppError("C", "m"));
    expect(env).toEqual({ success: false, data: null, error: { code: "C", message: "m" } });
  });
  it("converts unknown", () => {
    const env = toEnvelope("oops", "FALLBACK");
    expect(env.success).toBe(false);
    expect(env.error?.code).toBe("FALLBACK");
  });
});
