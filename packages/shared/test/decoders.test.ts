import { describe, expect, it } from "vitest";

import {
  decodeContractEvent,
  decodeProofchainLog,
  parseContractLogs,
  parseRawEventLog,
  tryDecodeProofchainLog,
} from "../src/decoders";
import { DecodeError, ValidationError } from "../src/errors";
import {
  FIXTURES,
  encodeAttested,
  encodeBatchRegistered,
  encodeFunded,
  encodeTransfer,
} from "./helpers";

describe("parseRawEventLog", () => {
  it("accepts a well-formed log", () => {
    const log = encodeBatchRegistered();
    const parsed = parseRawEventLog(log);
    expect(parsed.data).toBe(log.data);
    expect(parsed.topics).toEqual(log.topics);
  });

  it("throws ValidationError on non-hex data", () => {
    expect(() => parseRawEventLog({ topics: [], data: "nope" })).toThrow(
      ValidationError,
    );
  });

  it("throws ValidationError on more than four topics", () => {
    const t = "0x" + "00".repeat(32);
    expect(() =>
      parseRawEventLog({ topics: [t, t, t, t, t], data: "0x" }),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError when topics is missing", () => {
    expect(() => parseRawEventLog({ data: "0x" })).toThrow(ValidationError);
  });
});

describe("decodeContractEvent", () => {
  it("decodes a BatchRegistered event with correct args", () => {
    const decoded = decodeContractEvent(
      "ProvenanceRegistry",
      encodeBatchRegistered(),
    );
    expect(decoded).not.toBeNull();
    expect(decoded?.contract).toBe("ProvenanceRegistry");
    expect(decoded?.eventName).toBe("BatchRegistered");
    expect(decoded?.args.batchId).toBe(FIXTURES.BATCH_ID);
    expect(decoded?.args.supplier).toBe(FIXTURES.ADDR_A);
    expect(decoded?.args.metadataURI).toBe("ipfs://meta");
  });

  it("returns null when the log does not match the ABI", () => {
    // A Transfer log will not decode against the ProvenanceRegistry ABI.
    const decoded = decodeContractEvent("ProvenanceRegistry", encodeTransfer(1n));
    expect(decoded).toBeNull();
  });
});

describe("decodeProofchainLog", () => {
  it("routes an Attested event to AttestationRegistry", () => {
    const decoded = decodeProofchainLog(encodeAttested(9600));
    expect(decoded.contract).toBe("AttestationRegistry");
    expect(decoded.eventName).toBe("Attested");
    expect(Number(decoded.args.score)).toBe(9600);
  });

  it("routes a Funded event to SettlementEscrow", () => {
    const decoded = decodeProofchainLog(encodeFunded(1_000_000n));
    expect(decoded.contract).toBe("SettlementEscrow");
    expect(decoded.eventName).toBe("Funded");
    expect(decoded.args.amount).toBe(1_000_000n);
  });

  it("routes a Transfer event to MockUSDC", () => {
    const decoded = decodeProofchainLog(encodeTransfer(42n));
    expect(decoded.contract).toBe("MockUSDC");
    expect(decoded.eventName).toBe("Transfer");
    expect(decoded.args.value).toBe(42n);
  });

  it("throws DecodeError for an unrecognized log", () => {
    const unknownTopic = "0x" + "ab".repeat(32);
    expect(() =>
      decodeProofchainLog({ topics: [unknownTopic], data: "0x" }),
    ).toThrow(DecodeError);
  });
});

describe("tryDecodeProofchainLog", () => {
  it("returns the decoded event on match", () => {
    const decoded = tryDecodeProofchainLog(encodeBatchRegistered());
    expect(decoded?.eventName).toBe("BatchRegistered");
  });

  it("returns null for an unrecognized log", () => {
    const unknownTopic = "0x" + "cd".repeat(32);
    expect(
      tryDecodeProofchainLog({ topics: [unknownTopic], data: "0x" }),
    ).toBeNull();
  });

  it("still throws ValidationError for structurally invalid input", () => {
    expect(() => tryDecodeProofchainLog({ topics: "x", data: "0x" })).toThrow(
      ValidationError,
    );
  });
});

describe("parseContractLogs", () => {
  it("decodes matching logs and filters non-matching ones", () => {
    const good = encodeAttested(8000);
    const logs = [
      { ...good, blockNumber: 1n, logIndex: 0 },
      { ...encodeTransfer(5n), blockNumber: 1n, logIndex: 1 },
    ] as never;
    const parsed = parseContractLogs("AttestationRegistry", logs);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.eventName).toBe("Attested");
  });

  it("throws ValidationError when logs is not an array", () => {
    expect(() =>
      parseContractLogs("MockUSDC", "not-an-array" as never),
    ).toThrow(ValidationError);
  });
});
