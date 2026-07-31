import {
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";

import {
  ComplianceStanding,
  CredentialStatus,
  decodeCredentialStatusChanged,
  decodeMilestoneReleased,
  decodeStandingChanged,
} from "../src";
import { ValidationError } from "../src/errors";

function asTopics(topics: readonly (Hex | readonly Hex[] | null)[]): Hex[] {
  return topics.map((t) => {
    if (typeof t !== "string") throw new Error("non-scalar topic in fixture");
    return t;
  });
}

const ADDR_A = "0x1111111111111111111111111111111111111111" as const;
const ADDR_B = "0x2222222222222222222222222222222222222222" as const;
const ID_A =
  "0x00000000000000000000000000000000000000000000000000000000000000aa" as const;

const credentialStatusChangedAbi = [
  {
    type: "event",
    name: "CredentialStatusChanged",
    anonymous: false,
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "status", type: "uint8", indexed: false },
    ],
  },
] as const;

function encodeCredentialStatusChanged(status: number): {
  topics: Hex[];
  data: Hex;
} {
  const topics = asTopics(
    encodeEventTopics({
      abi: credentialStatusChangedAbi,
      eventName: "CredentialStatusChanged",
      args: { tokenId: 3n },
    }),
  );
  const data = encodeAbiParameters([{ type: "uint8" }], [status]);
  return { topics, data };
}

const milestoneReleasedAbi = [
  {
    type: "event",
    name: "MilestoneReleased",
    anonymous: false,
    inputs: [
      { name: "agreementId", type: "bytes32", indexed: true },
      { name: "index", type: "uint16", indexed: true },
      { name: "worker", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

function encodeMilestoneReleased(): { topics: Hex[]; data: Hex } {
  const topics = asTopics(
    encodeEventTopics({
      abi: milestoneReleasedAbi,
      eventName: "MilestoneReleased",
      args: { agreementId: ID_A, index: 2, worker: ADDR_B },
    }),
  );
  const data = encodeAbiParameters([{ type: "uint256" }], [250_000n]);
  return { topics, data };
}

const standingChangedAbi = [
  {
    type: "event",
    name: "StandingChanged",
    anonymous: false,
    inputs: [
      { name: "employer", type: "address", indexed: true },
      { name: "standing", type: "uint8", indexed: false },
    ],
  },
] as const;

function encodeStandingChanged(standing: number): { topics: Hex[]; data: Hex } {
  const topics = asTopics(
    encodeEventTopics({
      abi: standingChangedAbi,
      eventName: "StandingChanged",
      args: { employer: ADDR_A },
    }),
  );
  const data = encodeAbiParameters([{ type: "uint8" }], [standing]);
  return { topics, data };
}

// ---------------------------------------------------------------------------

describe("decodeCredentialStatusChanged", () => {
  it("decodes the status as a branded enum", () => {
    const decoded = decodeCredentialStatusChanged(
      encodeCredentialStatusChanged(CredentialStatus.Suspended),
    );
    expect(decoded?.tokenId).toBe(3n);
    expect(decoded?.status).toBe(CredentialStatus.Suspended);
  });

  it("throws ValidationError on an out-of-range status", () => {
    expect(() =>
      decodeCredentialStatusChanged(encodeCredentialStatusChanged(7)),
    ).toThrow(ValidationError);
  });

  it("returns null for a different event", () => {
    expect(decodeCredentialStatusChanged(encodeStandingChanged(1))).toBeNull();
  });
});

describe("decodeMilestoneReleased", () => {
  it("decodes indexed uint16 + address and non-indexed amount", () => {
    const decoded = decodeMilestoneReleased(encodeMilestoneReleased());
    expect(decoded?.agreementId).toBe(ID_A);
    expect(decoded?.index).toBe(2);
    expect(decoded?.worker).toBe(getAddress(ADDR_B));
    expect(decoded?.amount).toBe(250_000n);
  });
});

describe("decodeStandingChanged", () => {
  it("decodes the compliance standing enum", () => {
    const decoded = decodeStandingChanged(
      encodeStandingChanged(ComplianceStanding.NonCompliant),
    );
    expect(decoded?.employer).toBe(getAddress(ADDR_A));
    expect(decoded?.standing).toBe(ComplianceStanding.NonCompliant);
  });

  it("throws ValidationError on an out-of-range standing", () => {
    expect(() => decodeStandingChanged(encodeStandingChanged(42))).toThrow(
      ValidationError,
    );
  });
});
