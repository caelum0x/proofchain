import { describe, expect, it } from "vitest";
import {
  normalizeAddress,
  decodeActorProfileView,
  decodeOrganizationView,
  decodeReputationView,
  gradeLabel,
  gradeTone,
  sortLeaderboard,
  EMPTY_REPUTATION,
  type LeaderboardEntry,
} from "@/lib/directory";

const ADDR = "0x1111111111111111111111111111111111111111";
const ADDR2 = "0x2222222222222222222222222222222222222222";
const ADDR3 = "0x3333333333333333333333333333333333333333";
const ORG_ID = `0x${"ab".repeat(32)}`;

describe("normalizeAddress", () => {
  it("checksums a valid lowercase address", () => {
    expect(normalizeAddress(ADDR)).toBe("0x1111111111111111111111111111111111111111");
  });
  it("trims surrounding whitespace", () => {
    expect(normalizeAddress(`  ${ADDR}  `)).toBe(ADDR);
  });
  it("rejects non-addresses", () => {
    expect(normalizeAddress("not-an-address")).toBeUndefined();
    expect(normalizeAddress("0x1234")).toBeUndefined();
    expect(normalizeAddress(undefined)).toBeUndefined();
    expect(normalizeAddress("")).toBeUndefined();
  });
});

describe("decodeActorProfileView", () => {
  it("decodes a profile tuple object", () => {
    const view = decodeActorProfileView({
      account: ADDR,
      name: "Acme",
      uri: "ipfs://x",
      registeredAt: 1_700_000_000n,
      exists: true,
    });
    expect(view).toEqual({
      account: ADDR,
      name: "Acme",
      uri: "ipfs://x",
      registeredAt: 1_700_000_000,
      exists: true,
    });
  });
  it("returns null for malformed input", () => {
    expect(decodeActorProfileView(null)).toBeNull();
    expect(decodeActorProfileView({ name: "x" })).toBeNull();
  });
});

describe("decodeOrganizationView", () => {
  it("decodes an organization tuple", () => {
    const view = decodeOrganizationView({
      orgId: ORG_ID,
      name: "Org",
      orgType: 1,
      metadataURI: "https://x",
      admin: ADDR,
      createdAt: 42n,
      exists: true,
    });
    expect(view?.orgType).toBe(1);
    expect(view?.createdAt).toBe(42);
    expect(view?.admin).toBe(ADDR);
  });
  it("returns null when not an org", () => {
    expect(decodeOrganizationView({})).toBeNull();
  });
});

describe("decodeReputationView", () => {
  it("decodes a positional tuple", () => {
    expect(decodeReputationView([9600n, 12n, 8000n, 1n])).toEqual({
      avgScoreBps: 9600,
      totalDeals: 12,
      passRateBps: 8000,
      disputes: 1,
    });
  });
  it("decodes a named object", () => {
    expect(
      decodeReputationView({
        avgScoreBps: 5000,
        totalDeals: 3n,
        passRateBps: 6667,
        disputes: 0n,
      }),
    ).toEqual({ avgScoreBps: 5000, totalDeals: 3, passRateBps: 6667, disputes: 0 });
  });
  it("returns null for empty/unknown shapes", () => {
    expect(decodeReputationView(null)).toBeNull();
    expect(decodeReputationView([1n, 2n])).toBeNull();
  });
});

describe("grade helpers", () => {
  it("labels every grade", () => {
    expect(gradeLabel(0)).toBe("Ungraded");
    expect(gradeLabel(1)).toBe("A+");
    expect(gradeLabel(7)).toBe("F");
    expect(gradeLabel(99)).toBe("Unknown");
  });
  it("maps grades to tones", () => {
    expect(gradeTone(0)).toBe("neutral");
    expect(gradeTone(1)).toBe("success");
    expect(gradeTone(3)).toBe("brand");
    expect(gradeTone(5)).toBe("warn");
    expect(gradeTone(7)).toBe("danger");
  });
});

describe("sortLeaderboard", () => {
  const entry = (
    account: string,
    passRateBps: number,
    avgScoreBps: number,
    totalDeals: number,
    disputes = 0,
  ): LeaderboardEntry => ({
    account: account as LeaderboardEntry["account"],
    name: account,
    grade: 1,
    reputation: { ...EMPTY_REPUTATION, passRateBps, avgScoreBps, totalDeals, disputes },
  });

  it("orders by pass rate, then score, then deals", () => {
    const sorted = sortLeaderboard([
      entry(ADDR, 5000, 9000, 2),
      entry(ADDR2, 9000, 5000, 1),
      entry(ADDR3, 9000, 9000, 10),
    ]);
    expect(sorted.map((e) => e.account)).toEqual([ADDR3, ADDR2, ADDR]);
  });

  it("breaks ties by fewest disputes", () => {
    const sorted = sortLeaderboard([
      entry(ADDR, 8000, 8000, 5, 3),
      entry(ADDR2, 8000, 8000, 5, 0),
    ]);
    expect(sorted[0].account).toBe(ADDR2);
  });

  it("does not mutate the input array", () => {
    const input = [entry(ADDR, 1000, 1000, 1), entry(ADDR2, 9000, 9000, 9)];
    const copy = [...input];
    sortLeaderboard(input);
    expect(input).toEqual(copy);
  });
});
