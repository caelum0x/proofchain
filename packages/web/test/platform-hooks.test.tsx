import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DecodedLog } from "@/hooks/useContractLogs";
import { reduceNftOwners, isNftCollection, NFT_COLLECTIONS } from "@/hooks/useNfts";
import { reduceDisputed } from "@/hooks/useDisputes";
import { reduceProposals } from "@/hooks/useGovernance";
import { PROPOSAL_STATE_LABEL, VoteSupport } from "@/hooks/useGovernance";
import { ASSET_KIND_LABEL, LISTING_STATUS_LABEL } from "@/hooks/useMarketplace";
import { AUCTION_STATE_LABEL } from "@/hooks/useAuctions";
import { DisputeStateBadge } from "@/components/disputes/DisputeStateBadge";
import { ProposalStateBadge } from "@/components/governance/ProposalStateBadge";
import { EsgScoreBadge } from "@/components/esg/EsgScoreBadge";

const ADDR_A = "0x1111111111111111111111111111111111111111" as const;
const ADDR_B = "0x2222222222222222222222222222222222222222" as const;
const ZERO = "0x0000000000000000000000000000000000000000" as const;
const BATCH = "0xabc0000000000000000000000000000000000000000000000000000000000001" as const;

function log(args: Record<string, unknown>, index = 0): DecodedLog {
  return { args, blockNumber: BigInt(index + 1), transactionHash: `0x${"0".repeat(63)}${index}`, logIndex: index };
}

describe("reduceNftOwners", () => {
  it("keeps the most-recent transfer per tokenId as the current owner", () => {
    // Logs are most-recent-first: token 1 last went to B, token 2 to A.
    const logs: DecodedLog[] = [
      log({ tokenId: 1n, from: ADDR_A, to: ADDR_B }, 3),
      log({ tokenId: 2n, from: ZERO, to: ADDR_A }, 2),
      log({ tokenId: 1n, from: ZERO, to: ADDR_A }, 1),
    ];
    const items = reduceNftOwners(logs, "BatchNFT");
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.tokenId === 1n)?.owner).toBe(ADDR_B);
    // Sorted highest tokenId first.
    expect(items[0].tokenId).toBe(2n);
  });

  it("excludes burned tokens (transferred to the zero address)", () => {
    const logs: DecodedLog[] = [
      log({ tokenId: 5n, from: ADDR_A, to: ZERO }, 2),
      log({ tokenId: 5n, from: ZERO, to: ADDR_A }, 1),
    ];
    expect(reduceNftOwners(logs, "InvoiceNFT")).toHaveLength(0);
  });

  it("filters to a single owner when requested (case-insensitive)", () => {
    const logs: DecodedLog[] = [
      log({ tokenId: 1n, from: ZERO, to: ADDR_A }, 2),
      log({ tokenId: 2n, from: ZERO, to: ADDR_B }, 1),
    ];
    const mine = reduceNftOwners(logs, "BatchNFT", ADDR_A.toUpperCase() as `0x${string}`);
    expect(mine).toHaveLength(1);
    expect(mine[0].tokenId).toBe(1n);
  });
});

describe("isNftCollection", () => {
  it("recognises the three collections and rejects others", () => {
    expect(NFT_COLLECTIONS).toHaveLength(3);
    expect(isNftCollection("BatchNFT")).toBe(true);
    expect(isNftCollection("InvoiceNFT")).toBe(true);
    expect(isNftCollection("WarehouseReceipt")).toBe(true);
    expect(isNftCollection("NotACollection")).toBe(false);
  });
});

describe("reduceDisputed", () => {
  it("de-duplicates by batch id keeping the latest score", () => {
    const logs: DecodedLog[] = [
      log({ batchId: BATCH, score: 4200 }, 2),
      log({ batchId: BATCH, score: 100 }, 1),
    ];
    const items = reduceDisputed(logs);
    expect(items).toHaveLength(1);
    expect(items[0].score).toBe(4200);
  });

  it("coerces bigint scores to numbers", () => {
    const items = reduceDisputed([log({ batchId: BATCH, score: 6900n }, 1)]);
    expect(items[0].score).toBe(6900);
  });
});

describe("reduceProposals", () => {
  it("de-duplicates by proposal id and preserves description + proposer", () => {
    const logs: DecodedLog[] = [
      log({ proposalId: 42n, proposer: ADDR_A, description: "Raise fees", voteStart: 10n, voteEnd: 20n }, 2),
      log({ proposalId: 42n, proposer: ADDR_A, description: "dup", voteStart: 1n, voteEnd: 2n }, 1),
    ];
    const proposals = reduceProposals(logs);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].id).toBe("42");
    expect(proposals[0].description).toBe("Raise fees");
    expect(proposals[0].proposer).toBe(ADDR_A);
  });
});

describe("label maps", () => {
  it("cover the full enum ranges", () => {
    expect(PROPOSAL_STATE_LABEL[1]).toBe("Active");
    expect(PROPOSAL_STATE_LABEL[7]).toBe("Executed");
    expect(Object.keys(PROPOSAL_STATE_LABEL)).toHaveLength(8);
    expect(VoteSupport).toEqual({ Against: 0, For: 1, Abstain: 2 });
    expect(ASSET_KIND_LABEL[2]).toBe("ERC721");
    expect(LISTING_STATUS_LABEL[1]).toBe("Active");
    expect(AUCTION_STATE_LABEL[2]).toBe("Settled");
  });
});

describe("presentational badges", () => {
  it("renders the arbitration state label", () => {
    render(<DisputeStateBadge state={1} />);
    expect(screen.getByText("Voting open")).toBeInTheDocument();
  });

  it("renders the proposal state label", () => {
    render(<ProposalStateBadge state={3} />);
    expect(screen.getByText("Defeated")).toBeInTheDocument();
  });

  it("renders an ESG score as a percentage", () => {
    render(<EsgScoreBadge score={9000} />);
    expect(screen.getByText("90.00%")).toBeInTheDocument();
  });
});
