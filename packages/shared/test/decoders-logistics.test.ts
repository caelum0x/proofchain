import {
  encodeAbiParameters,
  encodeEventTopics,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";

import {
  decodeColdChainReadingRecorded,
  decodeFreightRequested,
  decodeWaypointReached,
} from "../src/decoders/logistics";
import { FreightMode } from "../src/types/logistics";

const hex32 = (b: string): Hex => `0x${b.repeat(32)}` as Hex;
const SHIPPER = "0x3333333333333333333333333333333333333333" as const;
const CARRIER = "0x4444444444444444444444444444444444444444" as const;
const BOOKING = hex32("a1");
const BATCH = hex32("a2");
const ROUTE = hex32("a3");
const GEOHASH = hex32("a4");

const asScalar = (t: Hex | readonly Hex[] | null): Hex => {
  if (typeof t !== "string") throw new Error("non-scalar topic in fixture");
  return t;
};

const requestedAbi = [
  {
    type: "event",
    name: "Requested",
    anonymous: false,
    inputs: [
      { name: "bookingId", type: "bytes32", indexed: true },
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "shipper", type: "address", indexed: true },
      { name: "carrier", type: "address", indexed: false },
      { name: "mode", type: "uint8", indexed: false },
    ],
  },
] as const;

const readingAbi = [
  {
    type: "event",
    name: "ReadingRecorded",
    anonymous: false,
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "index", type: "uint256", indexed: true },
      { name: "temp", type: "int256", indexed: false },
      { name: "humidityBps", type: "uint16", indexed: false },
      { name: "breach", type: "bool", indexed: false },
    ],
  },
] as const;

const waypointAbi = [
  {
    type: "event",
    name: "WaypointReached",
    anonymous: false,
    inputs: [
      { name: "routeId", type: "bytes32", indexed: true },
      { name: "index", type: "uint16", indexed: true },
      { name: "geohash", type: "bytes32", indexed: false },
      { name: "reachedAt", type: "uint64", indexed: false },
    ],
  },
] as const;

function encodeRequested(mode: number) {
  const topics = encodeEventTopics({
    abi: requestedAbi,
    eventName: "Requested",
    args: { bookingId: BOOKING, batchId: BATCH, shipper: SHIPPER },
  }).map(asScalar);
  const data = encodeAbiParameters(
    [{ type: "address" }, { type: "uint8" }],
    [CARRIER, mode],
  );
  return { topics, data };
}

function encodeReading(temp: bigint, humidityBps: number, breach: boolean) {
  const topics = encodeEventTopics({
    abi: readingAbi,
    eventName: "ReadingRecorded",
    args: { batchId: BATCH, index: 3n },
  }).map(asScalar);
  const data = encodeAbiParameters(
    [{ type: "int256" }, { type: "uint16" }, { type: "bool" }],
    [temp, humidityBps, breach],
  );
  return { topics, data };
}

function encodeWaypoint(index: number, reachedAt: bigint) {
  const topics = encodeEventTopics({
    abi: waypointAbi,
    eventName: "WaypointReached",
    args: { routeId: ROUTE, index },
  }).map(asScalar);
  const data = encodeAbiParameters(
    [{ type: "bytes32" }, { type: "uint64" }],
    [GEOHASH, reachedAt],
  );
  return { topics, data };
}

describe("decodeFreightRequested", () => {
  it("decodes indexed parties and the mode enum", () => {
    const decoded = decodeFreightRequested(encodeRequested(FreightMode.Sea));
    expect(decoded?.bookingId).toBe(BOOKING);
    expect(decoded?.batchId).toBe(BATCH);
    expect(decoded?.shipper).toBe(SHIPPER);
    expect(decoded?.carrier).toBe(CARRIER);
    expect(decoded?.mode).toBe(FreightMode.Sea);
  });

  it("returns null for a mismatched decoder (cold-chain reading)", () => {
    expect(
      decodeColdChainReadingRecorded(encodeRequested(FreightMode.Air)),
    ).toBeNull();
  });
});

describe("decodeColdChainReadingRecorded", () => {
  it("preserves a negative int256 temperature", () => {
    const decoded = decodeColdChainReadingRecorded(
      encodeReading(-1850n, 6200, true),
    );
    expect(decoded?.batchId).toBe(BATCH);
    expect(decoded?.index).toBe(3n);
    expect(decoded?.temp).toBe(-1850n);
    expect(decoded?.humidityBps).toBe(6200);
    expect(decoded?.breach).toBe(true);
  });
});

describe("decodeWaypointReached", () => {
  it("decodes the uint16 indexed waypoint index as a number", () => {
    const decoded = decodeWaypointReached(encodeWaypoint(4, 1_700_000_000n));
    expect(decoded?.routeId).toBe(ROUTE);
    expect(decoded?.index).toBe(4);
    expect(decoded?.geohash).toBe(GEOHASH);
    expect(decoded?.reachedAt).toBe(1_700_000_000n);
  });
});
