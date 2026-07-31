import { describe, expect, it } from "vitest";
import { parseTokenInput } from "@/lib/amount";

describe("parseTokenInput", () => {
  it("parses whole numbers", () => {
    expect(parseTokenInput("1000", 6)).toEqual({ value: 1_000_000_000n, error: null });
  });
  it("parses fractional values", () => {
    expect(parseTokenInput("1.5", 6)).toEqual({ value: 1_500_000n, error: null });
  });
  it("rejects empty", () => {
    expect(parseTokenInput("", 6).error).toMatch(/required/i);
  });
  it("rejects non-numeric", () => {
    expect(parseTokenInput("abc", 6).error).toMatch(/positive number/i);
  });
  it("rejects zero", () => {
    expect(parseTokenInput("0", 6).error).toMatch(/greater than zero/i);
  });
  it("rejects too many decimals", () => {
    expect(parseTokenInput("1.1234567", 6).error).toMatch(/decimal places/i);
  });
  it("accepts max-precision value", () => {
    expect(parseTokenInput("0.000001", 6)).toEqual({ value: 1n, error: null });
  });
});
