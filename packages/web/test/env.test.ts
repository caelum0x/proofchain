import { describe, expect, it } from "vitest";
import {
  BASE_SEPOLIA_CHAIN_ID,
  ETHEREUM_SEPOLIA_CHAIN_ID,
  EXPECTED_CHAIN_ID,
  env,
  isEnvValid,
  isUnexpectedChain,
} from "@/lib/env";

describe("client env (with test setup values)", () => {
  it("is valid", () => {
    expect(isEnvValid).toBe(true);
  });
  it("targets the Ethereum Sepolia chain id", () => {
    expect(ETHEREUM_SEPOLIA_CHAIN_ID).toBe(11155111);
    expect(EXPECTED_CHAIN_ID).toBe(11155111);
    expect(BASE_SEPOLIA_CHAIN_ID).toBe(84532);
    expect(env.chainId).toBe(11155111);
    expect(isUnexpectedChain).toBe(false);
  });
  it("parses the agent api url", () => {
    expect(env.agentApiUrl).toMatch(/^https?:\/\//);
  });
});
