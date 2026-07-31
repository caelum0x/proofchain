import { describe, it, expect } from "vitest";
import {
  ok,
  err,
  isOk,
  isErr,
  toEnvelope,
  InfraError,
  InfraErrorCode,
} from "./errors.js";

describe("result envelope", () => {
  it("ok wraps data and is frozen", () => {
    const r = ok(42);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    if (isOk(r)) expect(r.data).toBe(42);
    expect(Object.isFrozen(r)).toBe(true);
  });

  it("err carries a structured envelope with details", () => {
    const r = err(InfraErrorCode.VALIDATION, "bad", { field: "x" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.error.code).toBe("INFRA_VALIDATION");
      expect(r.error.message).toBe("bad");
      expect(r.error.details).toEqual({ field: "x" });
      expect(Object.isFrozen(r.error)).toBe(true);
    }
  });

  it("err without details omits the details key", () => {
    const r = err(InfraErrorCode.IPFS, "boom");
    if (isErr(r)) expect(r.error.details).toBeUndefined();
  });
});

describe("InfraError + toEnvelope", () => {
  it("InfraError.toEnvelope reflects code/message/details", () => {
    const e = new InfraError(InfraErrorCode.SUPABASE, "db down", { table: "jobs" });
    expect(e.toEnvelope()).toEqual({
      code: "INFRA_SUPABASE",
      message: "db down",
      details: { table: "jobs" },
    });
  });

  it("toEnvelope normalizes InfraError, Error, and unknown", () => {
    expect(toEnvelope(new InfraError(InfraErrorCode.NETWORK, "x")).code).toBe(
      "INFRA_NETWORK",
    );
    expect(toEnvelope(new Error("plain")).message).toBe("plain");
    expect(toEnvelope("just a string").message).toBe("just a string");
    expect(toEnvelope(123).code).toBe("INFRA_UNEXPECTED");
  });
});
