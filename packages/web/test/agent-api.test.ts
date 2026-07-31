import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fileToBase64,
  getHealth,
  requestVerification,
  type Verdict,
} from "@/lib/agent-api";

const BYTES32 = `0x${"a".repeat(64)}` as `0x${string}`;

const validVerdict: Verdict = {
  batchId: BYTES32,
  score: 9600,
  passed: true,
  threshold: 7000,
  findings: [{ code: "OK", severity: "info", message: "clean" }],
  documentHashes: ["abc"],
  verdictURI: "ipfs://Qm",
  createdAt: "2026-01-01T00:00:00.000Z",
  model: "claude-opus-4-8",
};

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

describe("requestVerification", () => {
  it("returns a validated result from an enveloped response", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ success: true, data: { verdict: validVerdict, txHash: "0xdead" }, error: null }),
    );
    const result = await requestVerification(BYTES32, [
      { name: "invoice.pdf", mimeType: "application/pdf", dataBase64: "AA==" },
    ]);
    expect(result.verdict.score).toBe(9600);
    expect(result.txHash).toBe("0xdead");
  });

  it("rejects a non-bytes32 batch id before calling the network", async () => {
    const fetchSpy = mockFetch({});
    vi.stubGlobal("fetch", fetchSpy);
    await expect(requestVerification("bad", [{ name: "x", mimeType: "application/pdf", dataBase64: "AA==" }])).rejects.toThrow(/32-byte/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects empty document list", async () => {
    vi.stubGlobal("fetch", mockFetch({}));
    await expect(requestVerification(BYTES32, [])).rejects.toThrow(/at least one/i);
  });

  it("surfaces an error envelope from the agent", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ success: false, data: null, error: { message: "bad docs" } }),
    );
    await expect(
      requestVerification(BYTES32, [{ name: "x", mimeType: "application/pdf", dataBase64: "AA==" }]),
    ).rejects.toThrow(/bad docs/);
  });

  it("rejects a malformed verdict payload", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ success: true, data: { verdict: { score: "nope" } }, error: null }),
    );
    await expect(
      requestVerification(BYTES32, [{ name: "x", mimeType: "application/pdf", dataBase64: "AA==" }]),
    ).rejects.toThrow(/validation/i);
  });
});

describe("getHealth", () => {
  it("parses a health payload", async () => {
    vi.stubGlobal("fetch", mockFetch({ success: true, data: { status: "ok", chainId: 84532 } }));
    const health = await getHealth();
    expect(health.status).toBe("ok");
  });

  it("throws on unreachable agent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    await expect(getHealth()).rejects.toThrow(/reach the agent/i);
  });
});

describe("fileToBase64", () => {
  it("encodes file contents", async () => {
    const file = new File([new Uint8Array([104, 105])], "hi.txt", { type: "text/plain" });
    expect(await fileToBase64(file)).toBe(btoa("hi"));
  });
});
