import {
  encodeAbiParameters,
  encodeEventTopics,
  type AbiEvent,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";

import {
  decodeArbiterStaked,
  decodeDisputeResolved,
  decodeDisputeVoted,
  decodeGovernanceMinted,
  decodeProposalCreated,
  decodeProposalDescribed,
  decodeVoteCast,
} from "../src/decoders/governance";
import { ValidationError } from "../src/errors";
import { GovernorVoteType } from "../src/types";

// --- encoding utilities ------------------------------------------------------

const ADDR_A = "0x1111111111111111111111111111111111111111" as const;
const ADDR_B = "0x2222222222222222222222222222222222222222" as const;
const ADDR_C = "0x3333333333333333333333333333333333333333" as const;
const BATCH_ID =
  "0x00000000000000000000000000000000000000000000000000000000000000aa" as const;

interface EncodedLog {
  readonly topics: readonly Hex[];
  readonly data: Hex;
}

function scalarTopics(
  topics: readonly (Hex | readonly Hex[] | null)[],
): Hex[] {
  return topics.map((t) => {
    if (typeof t !== "string") {
      throw new Error("Test fixture produced a non-scalar topic");
    }
    return t;
  });
}

const votedAbi = [
  {
    type: "event",
    name: "Voted",
    anonymous: false,
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "arbiter", type: "address", indexed: true },
      { name: "refundBuyer", type: "bool", indexed: false },
    ],
  },
] as const;

const resolvedAbi = [
  {
    type: "event",
    name: "Resolved",
    anonymous: false,
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "refundedBuyer", type: "bool", indexed: false },
    ],
  },
] as const;

const arbiterStakedAbi = [
  {
    type: "event",
    name: "ArbiterStaked",
    anonymous: false,
    inputs: [
      { name: "arbiter", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

const mintedAbi = [
  {
    type: "event",
    name: "Minted",
    anonymous: false,
    inputs: [
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

const voteCastAbi = [
  {
    type: "event",
    name: "VoteCast",
    anonymous: false,
    inputs: [
      { name: "voter", type: "address", indexed: true },
      { name: "proposalId", type: "uint256", indexed: false },
      { name: "support", type: "uint8", indexed: false },
      { name: "weight", type: "uint256", indexed: false },
      { name: "reason", type: "string", indexed: false },
    ],
  },
] as const;

const proposalCreatedAbi = [
  {
    type: "event",
    name: "ProposalCreated",
    anonymous: false,
    inputs: [
      { name: "proposalId", type: "uint256", indexed: false },
      { name: "proposer", type: "address", indexed: false },
      { name: "targets", type: "address[]", indexed: false },
      { name: "values", type: "uint256[]", indexed: false },
      { name: "signatures", type: "string[]", indexed: false },
      { name: "calldatas", type: "bytes[]", indexed: false },
      { name: "voteStart", type: "uint256", indexed: false },
      { name: "voteEnd", type: "uint256", indexed: false },
      { name: "description", type: "string", indexed: false },
    ],
  },
] as const;

const proposalDescribedAbi = [
  {
    type: "event",
    name: "ProposalDescribed",
    anonymous: false,
    inputs: [
      { name: "proposalId", type: "uint256", indexed: true },
      { name: "uri", type: "string", indexed: false },
      { name: "author", type: "address", indexed: true },
    ],
  },
] as const;

function topics(
  abi: readonly AbiEvent[],
  eventName: string,
  args: Record<string, unknown>,
): Hex[] {
  return scalarTopics(
    encodeEventTopics({ abi, eventName, args } as never),
  );
}

// --- tests -------------------------------------------------------------------

describe("decodeDisputeVoted", () => {
  it("decodes indexed address/bytes32 and the bool payload", () => {
    const log: EncodedLog = {
      topics: topics(votedAbi as never, "Voted", {
        batchId: BATCH_ID,
        arbiter: ADDR_A,
      }),
      data: encodeAbiParameters([{ type: "bool" }], [true]),
    };
    const ev = decodeDisputeVoted(log);
    expect(ev.batchId).toBe(BATCH_ID);
    expect(ev.arbiter).toBe(ADDR_A);
    expect(ev.refundBuyer).toBe(true);
  });

  it("throws ValidationError when the log is a different event", () => {
    const log: EncodedLog = {
      topics: topics(resolvedAbi as never, "Resolved", { batchId: BATCH_ID }),
      data: encodeAbiParameters([{ type: "bool" }], [false]),
    };
    expect(() => decodeDisputeVoted(log)).toThrow(ValidationError);
  });
});

describe("decodeDisputeResolved", () => {
  it("decodes the resolution outcome bool", () => {
    const log: EncodedLog = {
      topics: topics(resolvedAbi as never, "Resolved", { batchId: BATCH_ID }),
      data: encodeAbiParameters([{ type: "bool" }], [false]),
    };
    const ev = decodeDisputeResolved(log);
    expect(ev.batchId).toBe(BATCH_ID);
    expect(ev.refundedBuyer).toBe(false);
  });
});

describe("decodeVoteCast", () => {
  it("narrows the uint8 support value into the GovernorVoteType enum", () => {
    const log: EncodedLog = {
      topics: topics(voteCastAbi as never, "VoteCast", { voter: ADDR_A }),
      data: encodeAbiParameters(
        [
          { type: "uint256" },
          { type: "uint8" },
          { type: "uint256" },
          { type: "string" },
        ],
        [7n, 1, 500n, "in favour"],
      ),
    };
    const ev = decodeVoteCast(log);
    expect(ev.voter).toBe(ADDR_A);
    expect(ev.proposalId).toBe(7n);
    expect(ev.support).toBe(GovernorVoteType.For);
    expect(ev.weight).toBe(500n);
    expect(ev.reason).toBe("in favour");
  });

  it("rejects an out-of-range support enum value", () => {
    const log: EncodedLog = {
      topics: topics(voteCastAbi as never, "VoteCast", { voter: ADDR_A }),
      data: encodeAbiParameters(
        [
          { type: "uint256" },
          { type: "uint8" },
          { type: "uint256" },
          { type: "string" },
        ],
        [1n, 9, 1n, ""],
      ),
    };
    expect(() => decodeVoteCast(log)).toThrow(ValidationError);
  });
});

describe("decodeProposalCreated", () => {
  it("decodes the dynamic array payload into immutable arrays", () => {
    const log: EncodedLog = {
      topics: topics(proposalCreatedAbi as never, "ProposalCreated", {}),
      data: encodeAbiParameters(
        [
          { type: "uint256" },
          { type: "address" },
          { type: "address[]" },
          { type: "uint256[]" },
          { type: "string[]" },
          { type: "bytes[]" },
          { type: "uint256" },
          { type: "uint256" },
          { type: "string" },
        ],
        [
          42n,
          ADDR_A,
          [ADDR_B, ADDR_C],
          [0n, 1n],
          ["", "setFee(uint256)"],
          ["0x", "0xdeadbeef"],
          100n,
          200n,
          "Adjust protocol fee",
        ],
      ),
    };
    const ev = decodeProposalCreated(log);
    expect(ev.proposalId).toBe(42n);
    expect(ev.proposer).toBe(ADDR_A);
    expect(ev.targets).toEqual([ADDR_B, ADDR_C]);
    expect(ev.values).toEqual([0n, 1n]);
    expect(ev.signatures).toEqual(["", "setFee(uint256)"]);
    expect(ev.calldatas).toEqual(["0x", "0xdeadbeef"]);
    expect(ev.voteStart).toBe(100n);
    expect(ev.voteEnd).toBe(200n);
    expect(ev.description).toBe("Adjust protocol fee");
    expect(Object.isFrozen(ev.targets)).toBe(true);
  });
});

describe("decodeProposalDescribed", () => {
  it("decodes the metadata URI + indexed author", () => {
    const log: EncodedLog = {
      topics: topics(proposalDescribedAbi as never, "ProposalDescribed", {
        proposalId: 5n,
        author: ADDR_B,
      }),
      data: encodeAbiParameters([{ type: "string" }], ["ipfs://proposal"]),
    };
    const ev = decodeProposalDescribed(log);
    expect(ev.proposalId).toBe(5n);
    expect(ev.uri).toBe("ipfs://proposal");
    expect(ev.author).toBe(ADDR_B);
  });
});

describe("decodeArbiterStaked / decodeGovernanceMinted", () => {
  it("decodes the arbiter stake amount", () => {
    const log: EncodedLog = {
      topics: topics(arbiterStakedAbi as never, "ArbiterStaked", {
        arbiter: ADDR_A,
      }),
      data: encodeAbiParameters([{ type: "uint256" }], [1_000n]),
    };
    const ev = decodeArbiterStaked(log);
    expect(ev.arbiter).toBe(ADDR_A);
    expect(ev.amount).toBe(1_000n);
  });

  it("decodes a governance token mint", () => {
    const log: EncodedLog = {
      topics: topics(mintedAbi as never, "Minted", { to: ADDR_C }),
      data: encodeAbiParameters([{ type: "uint256" }], [7_500n]),
    };
    const ev = decodeGovernanceMinted(log);
    expect(ev.to).toBe(ADDR_C);
    expect(ev.amount).toBe(7_500n);
  });

  it("throws ValidationError on structurally invalid input", () => {
    expect(() => decodeArbiterStaked({ topics: "x", data: "0x" })).toThrow(
      ValidationError,
    );
  });
});
