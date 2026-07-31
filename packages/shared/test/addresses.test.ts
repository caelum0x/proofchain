import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  CONTRACTS,
  addressesFromManifest,
  getContractAddress,
  parseAddress,
  readDeploymentManifest,
  resolveContractAddresses,
  tryGetContractAddress,
} from "../src/addresses";
import { CHAIN_ID } from "../src/chains";
import {
  DeploymentParseError,
  InvalidAddressError,
  MissingAddressError,
} from "../src/errors";

const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";
const C = "0x3333333333333333333333333333333333333333";
const D = "0x4444444444444444444444444444444444444444";

describe("parseAddress", () => {
  it("checksums a valid lowercase address", () => {
    // vitalik.eth, known checksum
    const out = parseAddress("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
    expect(out).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
  });

  it("throws InvalidAddressError for a malformed address", () => {
    expect(() => parseAddress("0x1234")).toThrow(InvalidAddressError);
    expect(() => parseAddress("not-an-address")).toThrow(InvalidAddressError);
  });
});

describe("addressesFromManifest", () => {
  it("reads addresses nested under `contracts`", () => {
    const out = addressesFromManifest({
      chainId: CHAIN_ID,
      contracts: {
        ProvenanceRegistry: A,
        AttestationRegistry: B,
        SettlementEscrow: C,
        MockUSDC: D,
      },
    });
    expect(out.ProvenanceRegistry).toBe(parseAddress(A));
    expect(out.AttestationRegistry).toBe(parseAddress(B));
    expect(out.SettlementEscrow).toBe(parseAddress(C));
    expect(out.MockUSDC).toBe(parseAddress(D));
  });

  it("reads addresses from the top level (flat manifest)", () => {
    const out = addressesFromManifest({ ProvenanceRegistry: A });
    expect(out.ProvenanceRegistry).toBe(parseAddress(A));
    expect(out.MockUSDC).toBeUndefined();
  });

  it("ignores unknown keys", () => {
    const out = addressesFromManifest({ Something: A, deployedAt: "2026" });
    expect(out.ProvenanceRegistry).toBeUndefined();
  });

  it("throws DeploymentParseError for a non-object manifest", () => {
    expect(() => addressesFromManifest("nope")).toThrow(DeploymentParseError);
  });

  it("throws InvalidAddressError when a manifest address is malformed", () => {
    expect(() =>
      addressesFromManifest({ contracts: { MockUSDC: "0xbad" } }),
    ).toThrow(InvalidAddressError);
  });
});

describe("resolveContractAddresses", () => {
  it("prefers env overrides over the manifest", () => {
    const env = (name: string): string | undefined =>
      name === "MOCK_USDC_ADDRESS" ? B : undefined;
    const out = resolveContractAddresses({
      env,
      manifest: { contracts: { MockUSDC: A } },
    });
    expect(out.MockUSDC).toBe(parseAddress(B));
  });

  it("falls back to the manifest when no env override is present", () => {
    const out = resolveContractAddresses({
      env: () => undefined,
      manifest: { contracts: { ProvenanceRegistry: A } },
    });
    expect(out.ProvenanceRegistry).toBe(parseAddress(A));
  });

  it("supports the NEXT_PUBLIC_ prefixed override", () => {
    const env = (name: string): string | undefined =>
      name === "NEXT_PUBLIC_SETTLEMENT_ESCROW_ADDRESS" ? C : undefined;
    const out = resolveContractAddresses({ env });
    expect(out.SettlementEscrow).toBe(parseAddress(C));
  });

  it("returns an empty map when nothing is configured", () => {
    const out = resolveContractAddresses({ env: () => undefined });
    expect(Object.keys(out)).toHaveLength(0);
  });
});

describe("readDeploymentManifest", () => {
  const dir = mkdtempSync(join(tmpdir(), "proofchain-shared-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("reads and parses an existing manifest file", () => {
    const file = join(dir, "base-sepolia.json");
    writeFileSync(
      file,
      JSON.stringify({ chainId: CHAIN_ID, contracts: { MockUSDC: A } }),
    );
    const manifest = readDeploymentManifest(file);
    expect(manifest).toMatchObject({ chainId: CHAIN_ID });
    const addrs = resolveContractAddresses({
      env: () => undefined,
      manifest,
    });
    expect(addrs.MockUSDC).toBe(parseAddress(A));
  });

  it("returns null for an absent file (graceful degradation)", () => {
    expect(readDeploymentManifest(join(dir, "missing.json"))).toBeNull();
  });

  it("returns null for a file containing invalid JSON", () => {
    const file = join(dir, "broken.json");
    writeFileSync(file, "{ not json");
    expect(readDeploymentManifest(file)).toBeNull();
  });
});

describe("CONTRACTS map + accessors", () => {
  it("exposes an entry for the supported chain id", () => {
    expect(CONTRACTS).toHaveProperty(String(CHAIN_ID));
  });

  it("getContractAddress throws MissingAddressError when unconfigured", () => {
    // No deployment file / env in the test runtime.
    expect(() => getContractAddress("ProvenanceRegistry")).toThrow(
      MissingAddressError,
    );
  });

  it("tryGetContractAddress returns undefined when unconfigured", () => {
    expect(tryGetContractAddress("MockUSDC")).toBeUndefined();
  });
});
