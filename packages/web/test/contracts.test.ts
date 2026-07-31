import { describe, expect, it } from "vitest";
import {
  ALL_CONTRACT_NAMES,
  isContractName,
  type ContractName,
} from "@/lib/contract-names";
import { getAbi, ABI_REGISTRY } from "@/lib/abis";

describe("contract names", () => {
  it("includes the four legacy core contracts", () => {
    for (const name of ["ProvenanceRegistry", "AttestationRegistry", "SettlementEscrow", "MockUSDC"]) {
      expect(ALL_CONTRACT_NAMES).toContain(name);
    }
  });

  it("covers the SPEC2 platform modules", () => {
    // Spot-check one contract from each module group.
    const expected = [
      "AddressBook",
      "CheckpointOracle",
      "PaymentRouter",
      "SupplierRegistry",
      "ReputationEngine",
      "InvoiceFinancing",
      "InsurancePool",
      "DisputeArbitration",
      "CarbonCreditToken",
      "AuctionHouse",
      "ReferralProgram",
    ];
    for (const name of expected) {
      expect(ALL_CONTRACT_NAMES).toContain(name);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(ALL_CONTRACT_NAMES).size).toBe(ALL_CONTRACT_NAMES.length);
  });

  it("guards known and unknown names", () => {
    expect(isContractName("InvoiceNFT")).toBe(true);
    expect(isContractName("NotAContract")).toBe(false);
    expect(isContractName(42)).toBe(false);
  });
});

describe("ABI registry", () => {
  it("resolves a non-empty ABI for every contract name", () => {
    for (const name of ALL_CONTRACT_NAMES as readonly ContractName[]) {
      const abi = getAbi(name);
      expect(Array.isArray(abi), `${name} ABI is not an array`).toBe(true);
      expect(abi.length, `${name} ABI is empty`).toBeGreaterThan(0);
    }
  });

  it("exposes the registry keyed by contract name", () => {
    expect(Object.keys(ABI_REGISTRY)).toContain("SupplierRegistry");
  });
});
