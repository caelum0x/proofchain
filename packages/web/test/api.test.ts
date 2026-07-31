import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  apiGet,
  apiList,
  apiPost,
  buildQuery,
  getNetworkStats,
} from "@/lib/api";

function mockFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const response = {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  };
  return vi.fn().mockResolvedValue(response as unknown as Response);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildQuery", () => {
  it("returns empty string for no params", () => {
    expect(buildQuery()).toBe("");
    expect(buildQuery({})).toBe("");
  });
  it("skips null/undefined/empty values", () => {
    expect(buildQuery({ a: 1, b: undefined, c: null, d: "" })).toBe("?a=1");
  });
  it("encodes multiple values", () => {
    const qs = buildQuery({ page: 2, q: "acme corp", active: true });
    expect(qs).toContain("page=2");
    expect(qs).toContain("q=acme+corp");
    expect(qs).toContain("active=true");
  });
});

describe("apiGet", () => {
  const schema = z.object({ id: z.string(), score: z.number() });

  it("unwraps and validates an enveloped payload", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ success: true, data: { id: "b1", score: 42 }, error: null }),
    );
    const result = await apiGet("/batches/b1", schema);
    expect(result).toEqual({ id: "b1", score: 42 });
  });

  it("accepts a bare (un-enveloped) body", async () => {
    vi.stubGlobal("fetch", mockFetch({ id: "b1", score: 7 }));
    const result = await apiGet("/batches/b1", schema);
    expect(result.score).toBe(7);
  });

  it("throws on an error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ success: false, data: null, error: { message: "not found" } }),
    );
    await expect(apiGet("/batches/x", schema)).rejects.toThrow(/not found/);
  });

  it("throws a schema error on a malformed payload", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ success: true, data: { id: "b1", score: "nope" }, error: null }),
    );
    await expect(apiGet("/batches/b1", schema)).rejects.toThrow(/validation/i);
  });

  it("throws when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    await expect(apiGet("/health", schema)).rejects.toThrow(/reach the ProofChain API/i);
  });

  it("throws on a non-JSON response", async () => {
    const bad = {
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("Unexpected token");
      },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(bad as unknown as Response));
    await expect(apiGet("/health", schema)).rejects.toThrow(/non-JSON/i);
  });
});

describe("apiList", () => {
  const item = z.object({ id: z.string() });

  it("reads items + meta from an enveloped list", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        success: true,
        data: [{ id: "a" }, { id: "b" }],
        error: null,
        meta: { total: 10, page: 0, limit: 2 },
      }),
    );
    const result = await apiList("/suppliers", item);
    expect(result.items).toHaveLength(2);
    expect(result.meta).toEqual({ total: 10, page: 0, limit: 2 });
  });

  it("accepts a { items } shaped payload and derives meta when absent", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ success: true, data: { items: [{ id: "a" }] }, error: null }),
    );
    const result = await apiList("/suppliers", item);
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it("throws when the payload is not a list", async () => {
    vi.stubGlobal("fetch", mockFetch({ success: true, data: { nope: 1 }, error: null }));
    await expect(apiList("/suppliers", item)).rejects.toThrow(/list payload/i);
  });
});

describe("apiPost", () => {
  it("serialises the body and validates the response", async () => {
    const fetchSpy = mockFetch({ success: true, data: { ok: true }, error: null });
    vi.stubGlobal("fetch", fetchSpy);
    const result = await apiPost("/financing/list", z.object({ ok: z.boolean() }), {
      batchId: "0x1",
    });
    expect(result.ok).toBe(true);
    const call = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(call.method).toBe("POST");
    expect(call.body).toBe(JSON.stringify({ batchId: "0x1" }));
  });
});

describe("getNetworkStats", () => {
  it("validates a partial stats payload", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ success: true, data: { totalBatches: 3, totalValueSettled: "1000000" }, error: null }),
    );
    const stats = await getNetworkStats();
    expect(stats.totalBatches).toBe(3);
    expect(stats.totalValueSettled).toBe("1000000");
  });
});
