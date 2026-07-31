import { describe, expect, it } from "vitest";

import {
  decodeActorProfileEvent,
  decodeIdentityEvent,
  decodeKycSet,
  decodeOrgMembership,
  decodeOrgRegistered,
} from "../src/decoders/identity";
import { ValidationError } from "../src/errors";
import { KycLevel, OrgType } from "../src/types";
import {
  ADDR_A,
  ADDR_B,
  ADDR_C,
  ORG_ID,
  KycSetEvent,
  MemberAddedEvent,
  OrgRegisteredEvent,
  SupplierRegisteredEvent,
  buildLog,
} from "./domain-fixtures";

describe("decodeOrgRegistered", () => {
  it("narrows the uint8 orgType to the OrgType enum", () => {
    const log = buildLog(OrgRegisteredEvent, {
      orgId: ORG_ID,
      name: "Acme Foods",
      orgType: OrgType.Supplier,
      admin: ADDR_A,
    });
    const args = decodeOrgRegistered(log);
    expect(args).toEqual({
      orgId: ORG_ID,
      name: "Acme Foods",
      orgType: OrgType.Supplier,
      admin: ADDR_A,
    });
    expect(args?.orgType).toBe(OrgType.Supplier);
  });

  it("throws ValidationError for an out-of-range enum value", () => {
    const log = buildLog(OrgRegisteredEvent, {
      orgId: ORG_ID,
      name: "Bad",
      orgType: 99,
      admin: ADDR_A,
    });
    expect(() => decodeOrgRegistered(log)).toThrow(ValidationError);
  });
});

describe("decodeOrgMembership", () => {
  it("decodes a MemberAdded log", () => {
    const log = buildLog(MemberAddedEvent, { orgId: ORG_ID, member: ADDR_B });
    const args = decodeOrgMembership(log);
    expect(args).toEqual({ orgId: ORG_ID, member: ADDR_B });
  });
});

describe("decodeActorProfileEvent", () => {
  it("decodes a SupplierRegistered log against the SupplierRegistry", () => {
    const log = buildLog(SupplierRegisteredEvent, {
      account: ADDR_A,
      name: "Acme",
      uri: "ipfs://profile",
    });
    const args = decodeActorProfileEvent("SupplierRegistry", log);
    expect(args).toEqual({ account: ADDR_A, name: "Acme", uri: "ipfs://profile" });
  });

  it("returns null when the registry does not match the event", () => {
    const log = buildLog(SupplierRegisteredEvent, {
      account: ADDR_A,
      name: "Acme",
      uri: "ipfs://profile",
    });
    // A SupplierRegistered log will not match the BuyerRegistry ABI's events.
    expect(decodeActorProfileEvent("BuyerRegistry", log)).toBeNull();
  });
});

describe("decodeKycSet", () => {
  it("narrows the uint8 level to the KycLevel enum", () => {
    const log = buildLog(KycSetEvent, {
      account: ADDR_A,
      level: KycLevel.Enhanced,
      provider: ADDR_C,
    });
    const args = decodeKycSet(log);
    expect(args?.level).toBe(KycLevel.Enhanced);
    expect(args?.provider).toBe(ADDR_C);
  });
});

describe("decodeIdentityEvent", () => {
  it("routes an OrgRegistered log to its tagged union member", () => {
    const log = buildLog(OrgRegisteredEvent, {
      orgId: ORG_ID,
      name: "Acme Foods",
      orgType: OrgType.Buyer,
      admin: ADDR_A,
    });
    const decoded = decodeIdentityEvent(log);
    expect(decoded?.contract).toBe("OrganizationRegistry");
    expect(decoded?.eventName).toBe("OrgRegistered");
    if (decoded?.eventName === "OrgRegistered") {
      expect(decoded.args.orgType).toBe(OrgType.Buyer);
    }
  });

  it("routes a KycSet log to KYCRegistry", () => {
    const log = buildLog(KycSetEvent, {
      account: ADDR_A,
      level: KycLevel.Verified,
      provider: ADDR_C,
    });
    const decoded = decodeIdentityEvent(log);
    expect(decoded?.contract).toBe("KYCRegistry");
    expect(decoded?.eventName).toBe("KycSet");
  });

  it("returns null for an unrelated log", () => {
    // An Attested provenance log is not an identity event.
    const decoded = decodeIdentityEvent({
      topics: ["0x" + "ab".repeat(32)],
      data: "0x",
    });
    expect(decoded).toBeNull();
  });
});
