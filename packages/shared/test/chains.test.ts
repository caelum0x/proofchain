import { afterEach, describe, expect, it } from "vitest";

import {
  CHAIN_ID,
  DEFAULT_BASE_SEPOLIA_RPC,
  RPC_URL_ENV,
  baseSepolia,
  createBaseSepoliaChain,
  isSupportedChainId,
  readEnv,
} from "../src/chains";

describe("chain constants", () => {
  it("targets Base Sepolia (84532)", () => {
    expect(CHAIN_ID).toBe(84532);
    expect(baseSepolia.id).toBe(84532);
  });

  it("isSupportedChainId narrows only 84532", () => {
    expect(isSupportedChainId(84532)).toBe(true);
    expect(isSupportedChainId(1)).toBe(false);
  });
});

describe("createBaseSepoliaChain", () => {
  it("uses the default RPC when none is provided", () => {
    const prior = process.env[RPC_URL_ENV];
    delete process.env[RPC_URL_ENV];
    try {
      const chain = createBaseSepoliaChain();
      expect(chain.rpcUrls.default.http[0]).toBe(DEFAULT_BASE_SEPOLIA_RPC);
    } finally {
      if (prior !== undefined) process.env[RPC_URL_ENV] = prior;
    }
  });

  it("uses an explicit RPC override", () => {
    const chain = createBaseSepoliaChain("https://example.test/rpc");
    expect(chain.rpcUrls.default.http[0]).toBe("https://example.test/rpc");
  });
});

describe("readEnv", () => {
  const KEY = "PROOFCHAIN_TEST_ENV_VAR";
  afterEach(() => {
    delete process.env[KEY];
  });

  it("returns the value when set", () => {
    process.env[KEY] = "hello";
    expect(readEnv(KEY)).toBe("hello");
  });

  it("returns undefined for an empty string", () => {
    process.env[KEY] = "";
    expect(readEnv(KEY)).toBeUndefined();
  });

  it("returns undefined when unset", () => {
    expect(readEnv(RPC_URL_ENV + "_DOES_NOT_EXIST")).toBeUndefined();
  });
});
