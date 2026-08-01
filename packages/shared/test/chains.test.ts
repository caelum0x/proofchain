import { afterEach, describe, expect, it } from "vitest";

import {
  CHAIN_ID,
  DEFAULT_BASE_SEPOLIA_RPC,
  DEFAULT_ETHEREUM_SEPOLIA_RPC,
  ETHEREUM_SEPOLIA_CHAIN_ID,
  RPC_URL_ENV,
  baseSepolia,
  chainForId,
  createBaseSepoliaChain,
  createEthereumSepoliaChain,
  ethereumSepolia,
  isSupportedChainId,
  readEnv,
  resolveChainId,
} from "../src/chains";

describe("chain constants", () => {
  it("defaults to Ethereum Sepolia (11155111)", () => {
    expect(CHAIN_ID).toBe(11155111);
    expect(ethereumSepolia.id).toBe(11155111);
  });

  it("still exposes Base Sepolia (84532)", () => {
    expect(baseSepolia.id).toBe(84532);
  });

  it("isSupportedChainId narrows both supported chains", () => {
    expect(isSupportedChainId(11155111)).toBe(true);
    expect(isSupportedChainId(84532)).toBe(true);
    expect(isSupportedChainId(1)).toBe(false);
  });
});

describe("resolveChainId", () => {
  it("defaults to Ethereum Sepolia when unset", () => {
    expect(resolveChainId(() => undefined)).toBe(11155111);
  });

  it("honors a supported override", () => {
    expect(resolveChainId((n) => (n === "CHAIN_ID" ? "84532" : undefined))).toBe(
      84532,
    );
  });

  it("ignores an unsupported override (fail-safe to default)", () => {
    expect(resolveChainId(() => "1")).toBe(11155111);
  });
});

describe("createEthereumSepoliaChain / chainForId", () => {
  it("builds an Ethereum Sepolia chain (id 11155111)", () => {
    const chain = createEthereumSepoliaChain();
    expect(chain.id).toBe(11155111);
  });

  it("uses an explicit RPC override", () => {
    const chain = createEthereumSepoliaChain("https://eth.example/rpc");
    expect(chain.rpcUrls.default.http[0]).toBe("https://eth.example/rpc");
  });

  it("resolves the right chain for an id", () => {
    expect(chainForId(84532).id).toBe(84532);
    expect(chainForId(ETHEREUM_SEPOLIA_CHAIN_ID).id).toBe(11155111);
  });

  it("exposes the default Ethereum Sepolia RPC constant", () => {
    expect(DEFAULT_ETHEREUM_SEPOLIA_RPC).toMatch(/^https:\/\//);
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
