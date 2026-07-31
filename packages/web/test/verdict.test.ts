import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchVerdictJson, verdictSchema } from "@/lib/verdict";

const BYTES32 = `0x${"a".repeat(64)}`;

const valid = {
  batchId: BYTES32,
  score: 8000,
  passed: true,
  threshold: 7000,
  findings: [],
  documentHashes: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  model: "claude-opus-4-8",
};

function mockFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response);
}

afterEach(() => vi.unstubAllGlobals());

describe("verdictSchema", () => {
  it("accepts a valid verdict", () => {
    expect(verdictSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects an out-of-range score", () => {
    expect(verdictSchema.safeParse({ ...valid, score: 20000 }).success).toBe(false);
  });
});

describe("fetchVerdictJson", () => {
  it("fetches and validates from an ipfs uri", async () => {
    vi.stubGlobal("fetch", mockFetch(valid));
    const v = await fetchVerdictJson("ipfs://Qm");
    expect(v.score).toBe(8000);
  });
  it("throws on HTTP error", async () => {
    vi.stubGlobal("fetch", mockFetch({}, { ok: false, status: 404 }));
    await expect(fetchVerdictJson("ipfs://Qm")).rejects.toThrow(/HTTP 404/);
  });
  it("throws on schema mismatch", async () => {
    vi.stubGlobal("fetch", mockFetch({ score: "bad" }));
    await expect(fetchVerdictJson("https://x.test/v")).rejects.toThrow(/validation/i);
  });
});
