import { describe, expect, it } from "vitest";

import {
  ABIS,
  CONTRACT_ABIS,
  CONTRACT_NAMES,
  getAbi,
  isContractName,
  SettlementEscrowAbi,
  attestationRegistryAbi,
  mockUsdcAbi,
  provenanceRegistryAbi,
  settlementEscrowAbi,
} from "../src/abis/index";

describe("ABIS registry", () => {
  it("wires all 117 platform contracts", () => {
    expect(CONTRACT_NAMES.length).toBe(117);
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

describe("per-contract <Name>Abi consts", () => {
  it("expose a typed const per contract that is identical to the map entry", () => {
    // Spot-check a representative named const.
    expect(SettlementEscrowAbi).toBe(ABIS.SettlementEscrow);
  });

  it("CONTRACT_ABIS aliases the frozen ABIS registry", () => {
    expect(CONTRACT_ABIS).toBe(ABIS);
    expect(Object.isFrozen(CONTRACT_ABIS)).toBe(true);
  });
});
