import {
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";

import {
  decodeInspectionRecorded,
  decodeRoundFinalized,
  decodeSensorRegistered,
  InspectionOutcome,
  SensorType,
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
const ID_B =
  "0x00000000000000000000000000000000000000000000000000000000000000bb" as const;

const sensorRegisteredAbi = [
  {
    type: "event",
    name: "SensorRegistered",
    anonymous: false,
    inputs: [
      { name: "sensorId", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "deviceKey", type: "address", indexed: true },
      { name: "sensorType", type: "uint8", indexed: false },
    ],
  },
] as const;

function encodeSensorRegistered(sensorType: number): {
  topics: Hex[];
  data: Hex;
} {
  const topics = asTopics(
    encodeEventTopics({
      abi: sensorRegisteredAbi,
      eventName: "SensorRegistered",
      args: { sensorId: ID_A, owner: ADDR_A, deviceKey: ADDR_B },
    }),
  );
  const data = encodeAbiParameters([{ type: "uint8" }], [sensorType]);
  return { topics, data };
}

const inspectionRecordedAbi = [
  {
    type: "event",
    name: "InspectionRecorded",
    anonymous: false,
    inputs: [
      { name: "inspectionId", type: "bytes32", indexed: true },
      { name: "outcome", type: "uint8", indexed: false },
      { name: "defectPpm", type: "uint16", indexed: false },
      { name: "evidenceHash", type: "bytes32", indexed: false },
    ],
  },
] as const;

function encodeInspectionRecorded(outcome: number): {
  topics: Hex[];
  data: Hex;
} {
  const topics = asTopics(
    encodeEventTopics({
      abi: inspectionRecordedAbi,
      eventName: "InspectionRecorded",
      args: { inspectionId: ID_A },
    }),
  );
  const data = encodeAbiParameters(
    [{ type: "uint8" }, { type: "uint16" }, { type: "bytes32" }],
    [outcome, 1_200, ID_B],
  );
  return { topics, data };
}

const roundFinalizedAbi = [
  {
    type: "event",
    name: "RoundFinalized",
    anonymous: false,
    inputs: [
      { name: "feedId", type: "bytes32", indexed: true },
      { name: "roundId", type: "uint64", indexed: true },
      { name: "answer", type: "uint256", indexed: false },
      { name: "submissionCount", type: "uint8", indexed: false },
    ],
  },
] as const;

function encodeRoundFinalized(): { topics: Hex[]; data: Hex } {
  const topics = asTopics(
    encodeEventTopics({
      abi: roundFinalizedAbi,
      eventName: "RoundFinalized",
      args: { feedId: ID_A, roundId: 5n },
    }),
  );
  const data = encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint8" }],
    [42_000n, 3],
  );
  return { topics, data };
}

// ---------------------------------------------------------------------------

describe("decodeSensorRegistered", () => {
  it("decodes owner/deviceKey addresses and the sensor-type enum", () => {
    const decoded = decodeSensorRegistered(
      encodeSensorRegistered(SensorType.EnergyMeter),
    );
    expect(decoded?.sensorId).toBe(ID_A);
    expect(decoded?.owner).toBe(getAddress(ADDR_A));
    expect(decoded?.deviceKey).toBe(getAddress(ADDR_B));
    expect(decoded?.sensorType).toBe(SensorType.EnergyMeter);
  });

  it("throws ValidationError on an out-of-range sensor type", () => {
    expect(() => decodeSensorRegistered(encodeSensorRegistered(99))).toThrow(
      ValidationError,
    );
  });

  it("returns null for a different event", () => {
    expect(decodeSensorRegistered(encodeRoundFinalized())).toBeNull();
  });
});

describe("decodeInspectionRecorded", () => {
  it("decodes the outcome enum and uint16 defect rate", () => {
    const decoded = decodeInspectionRecorded(
      encodeInspectionRecorded(InspectionOutcome.Conditional),
    );
    expect(decoded?.inspectionId).toBe(ID_A);
    expect(decoded?.outcome).toBe(InspectionOutcome.Conditional);
    expect(decoded?.defectPpm).toBe(1_200);
    expect(decoded?.evidenceHash).toBe(ID_B);
  });

  it("throws ValidationError on an out-of-range outcome", () => {
    expect(() => decodeInspectionRecorded(encodeInspectionRecorded(8))).toThrow(
      ValidationError,
    );
  });
});

describe("decodeRoundFinalized", () => {
  it("decodes indexed uint64 roundId and non-indexed uint256/uint8", () => {
    const decoded = decodeRoundFinalized(encodeRoundFinalized());
    expect(decoded?.feedId).toBe(ID_A);
    expect(decoded?.roundId).toBe(5n);
    expect(decoded?.answer).toBe(42_000n);
    expect(decoded?.submissionCount).toBe(3);
  });
});
