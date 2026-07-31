import { describe, expect, it } from "vitest";

import {
  ABIS,
  CONTRACT_NAMES,
  getAbi,
  isContractName,
  attestationRegistryAbi,
  mockUsdcAbi,
  provenanceRegistryAbi,
  settlementEscrowAbi,
} from "../src/abis/index";

describe("ABIS registry", () => {
  it("wires all 61 platform contracts", () => {
    expect(CONTRACT_NAMES.length).toBe(61);
    // No duplicate names.
    expect(new Set(CONTRACT_NAMES).size).toBe(CONTRACT_NAMES.length);
  });

  it("has an ABI entry for every contract name", () => {
    for (const name of CONTRACT_NAMES) {
      const abi = ABIS[name];
      expect(Array.isArray(abi), `${name} ABI should be an array`).toBe(true);
      expect(abi.length, `${name} ABI should be non-empty`).toBeGreaterThan(0);
    }
  });

  it("covers the SPEC2 expansion modules", () => {
    const expected = [
      "AddressBook",
      "OrganizationRegistry",
      "ReputationEngine",
      "InvoiceNFT",
      "InvoiceFinancing",
      "PolicyManager",
      "ClaimsProcessor",
      "DisputeArbitration",
      "ProofChainGovernor",
      "CarbonCreditToken",
      "AuctionHouse",
      "RewardsDistributor",
    ];
    for (const name of expected) {
      expect(CONTRACT_NAMES).toContain(name);
    }
  });

  it("freezes the ABIS map", () => {
    expect(Object.isFrozen(ABIS)).toBe(true);
  });
});

describe("getAbi", () => {
  it("returns the ABI for a known contract", () => {
    expect(getAbi("InvoiceNFT")).toBe(ABIS.InvoiceNFT);
  });

  it("throws RangeError for an unknown contract", () => {
    // Cast through unknown to exercise the runtime guard.
    expect(() => getAbi("NotAContract" as unknown as never)).toThrow(RangeError);
  });
});

describe("isContractName", () => {
  it("accepts known names and rejects everything else", () => {
    expect(isContractName("SettlementEscrow")).toBe(true);
    expect(isContractName("BatchNFT")).toBe(true);
    expect(isContractName("Nope")).toBe(false);
    expect(isContractName(42)).toBe(false);
    expect(isContractName(null)).toBe(false);
  });
});

describe("legacy core ABI exports", () => {
  it("still resolve to the same objects as the map", () => {
    expect(provenanceRegistryAbi).toBe(ABIS.ProvenanceRegistry);
    expect(attestationRegistryAbi).toBe(ABIS.AttestationRegistry);
    expect(settlementEscrowAbi).toBe(ABIS.SettlementEscrow);
    expect(mockUsdcAbi).toBe(ABIS.MockUSDC);
  });
});
