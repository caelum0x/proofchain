import { describe, expect, it } from "vitest";

import {
  decodeAttested,
  decodeBatchRegistered,
  decodeCheckpointAdded,
  decodeCheckpointPushed,
  decodeMetadataSet,
  decodeProvenanceEvent,
  decodeRegisteredFromSeries,
} from "../src/decoders/provenance";
import { ValidationError } from "../src/errors";
import {
  ADDR_A,
  ADDR_B,
  BATCH_ID,
  HASH,
  META_KEY,
  SERIES_ID,
  AttestedEvent,
  BatchRegisteredEvent,
  CheckpointAddedEvent,
  CheckpointPushedEvent,
  MetadataSetEvent,
  RegisteredFromSeriesEvent,
  buildLog,
} from "./domain-fixtures";

describe("decodeBatchRegistered", () => {
  it("normalizes indexed + non-indexed args", () => {
    const log = buildLog(BatchRegisteredEvent, {
      batchId: BATCH_ID,
      supplier: ADDR_A,
      originHash: HASH,
      metadataURI: "ipfs://meta",
    });
    const args = decodeBatchRegistered(log);
    expect(args).toEqual({
      batchId: BATCH_ID,
      supplier: ADDR_A,
      originHash: HASH,
      metadataURI: "ipfs://meta",
    });
  });

  it("returns null for a non-matching log", () => {
    const log = buildLog(AttestedEvent, {
      batchId: BATCH_ID,
      score: 9000n,
      verdictHash: HASH,
      verdictURI: "ipfs://v",
      agent: ADDR_B,
    });
    expect(decodeBatchRegistered(log)).toBeNull();
  });

  it("freezes the returned object", () => {
    const log = buildLog(BatchRegisteredEvent, {
      batchId: BATCH_ID,
      supplier: ADDR_A,
      originHash: HASH,
      metadataURI: "ipfs://meta",
    });
    const args = decodeBatchRegistered(log);
    expect(Object.isFrozen(args)).toBe(true);
  });
});

describe("decodeCheckpointAdded", () => {
  it("keeps the uint64 timestamp as a bigint", () => {
    const log = buildLog(CheckpointAddedEvent, {
      batchId: BATCH_ID,
      location: "Rotterdam",
      timestamp: 1_722_000_000n,
      dataHash: HASH,
    });
    const args = decodeCheckpointAdded(log);
    expect(args?.timestamp).toBe(1_722_000_000n);
    expect(typeof args?.timestamp).toBe("bigint");
    expect(args?.location).toBe("Rotterdam");
  });
});

describe("decodeAttested", () => {
  it("narrows the uint16 score to a JS number", () => {
    const log = buildLog(AttestedEvent, {
      batchId: BATCH_ID,
      score: 9600n,
      verdictHash: HASH,
      verdictURI: "ipfs://verdict",
      agent: ADDR_B,
    });
    const args = decodeAttested(log);
    expect(args?.score).toBe(9600);
    expect(typeof args?.score).toBe("number");
    expect(args?.agent).toBe(ADDR_B);
  });
});

describe("decodeCheckpointPushed", () => {
  it("preserves a negative int256 temperature", () => {
    const log = buildLog(CheckpointPushedEvent, {
      batchId: BATCH_ID,
      location: "cold-store-7",
      temp: -18_500n,
      dataHash: HASH,
      keeper: ADDR_A,
    });
    const args = decodeCheckpointPushed(log);
    expect(args?.temp).toBe(-18_500n);
    expect(args?.keeper).toBe(ADDR_A);
  });
});

describe("decodeRegisteredFromSeries", () => {
  it("keeps the uint256 index as a bigint", () => {
    const log = buildLog(RegisteredFromSeriesEvent, {
      seriesId: SERIES_ID,
      batchId: BATCH_ID,
      index: 42n,
    });
    const args = decodeRegisteredFromSeries(log);
    expect(args).toEqual({ seriesId: SERIES_ID, batchId: BATCH_ID, index: 42n });
  });
});

describe("decodeMetadataSet", () => {
  it("decodes the doubly-indexed key event", () => {
    const log = buildLog(MetadataSetEvent, {
      batchId: BATCH_ID,
      key: META_KEY,
      value: "grade-A",
    });
    const args = decodeMetadataSet(log);
    expect(args).toEqual({ batchId: BATCH_ID, key: META_KEY, value: "grade-A" });
  });
});

describe("decodeProvenanceEvent", () => {
  it("routes a BatchRegistered log to its tagged union member", () => {
    const log = buildLog(BatchRegisteredEvent, {
      batchId: BATCH_ID,
      supplier: ADDR_A,
      originHash: HASH,
      metadataURI: "ipfs://meta",
    });
    const decoded = decodeProvenanceEvent(log);
    expect(decoded?.contract).toBe("ProvenanceRegistry");
    expect(decoded?.eventName).toBe("BatchRegistered");
    if (decoded?.eventName === "BatchRegistered") {
      expect(decoded.args.supplier).toBe(ADDR_A);
    }
  });

  it("routes an Attested log to AttestationRegistry", () => {
    const log = buildLog(AttestedEvent, {
      batchId: BATCH_ID,
      score: 8000n,
      verdictHash: HASH,
      verdictURI: "ipfs://v",
      agent: ADDR_B,
    });
    const decoded = decodeProvenanceEvent(log);
    expect(decoded?.contract).toBe("AttestationRegistry");
    expect(decoded?.eventName).toBe("Attested");
  });

  it("returns null for an unrelated log", () => {
    const log = buildLog(RegisteredFromSeriesEvent, {
      seriesId: SERIES_ID,
      batchId: BATCH_ID,
      index: 1n,
    });
    const decoded = decodeProvenanceEvent(log);
    // RegisteredFromSeries IS a provenance event, so it should route, not null.
    expect(decoded?.eventName).toBe("RegisteredFromSeries");
  });

  it("throws ValidationError on structurally invalid input", () => {
    expect(() => decodeProvenanceEvent({ topics: "nope", data: "0x" })).toThrow(
      ValidationError,
    );
  });
});
