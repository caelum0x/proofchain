import { describe, expect, it } from "vitest";

import { CONTRACT_NAMES } from "../src/abis/index";
import { envOverridesFor, toScreamingSnakeCase } from "../src/addresses";

describe("toScreamingSnakeCase", () => {
  it("splits PascalCase words", () => {
    expect(toScreamingSnakeCase("SettlementEscrow")).toBe("SETTLEMENT_ESCROW");
    expect(toScreamingSnakeCase("ProvenanceRegistry")).toBe(
      "PROVENANCE_REGISTRY",
    );
    expect(toScreamingSnakeCase("ProofChainGovernor")).toBe(
      "PROOF_CHAIN_GOVERNOR",
    );
  });

  it("handles trailing and leading acronyms", () => {
    expect(toScreamingSnakeCase("MockUSDC")).toBe("MOCK_USDC");
    expect(toScreamingSnakeCase("KYCRegistry")).toBe("KYC_REGISTRY");
    expect(toScreamingSnakeCase("ESGRegistry")).toBe("ESG_REGISTRY");
    expect(toScreamingSnakeCase("BatchNFT")).toBe("BATCH_NFT");
  });
});

describe("envOverridesFor", () => {
  it("produces a plain and NEXT_PUBLIC_ variant, in that order", () => {
    expect(envOverridesFor("MockUSDC")).toEqual([
      "MOCK_USDC_ADDRESS",
      "NEXT_PUBLIC_MOCK_USDC_ADDRESS",
    ]);
    expect(envOverridesFor("SettlementEscrow")).toEqual([
      "SETTLEMENT_ESCROW_ADDRESS",
      "NEXT_PUBLIC_SETTLEMENT_ESCROW_ADDRESS",
    ]);
  });

  it("yields two globally-unique env vars for every contract", () => {
    const all = CONTRACT_NAMES.flatMap((n) => envOverridesFor(n));
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(CONTRACT_NAMES.length * 2);
  });
});
