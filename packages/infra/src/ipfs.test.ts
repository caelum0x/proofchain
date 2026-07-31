import { describe, it, expect, vi, afterEach } from "vitest";
import { createIpfsClient, pinJson } from "./ipfs.js";
import { loadInfraConfig } from "./env.js";
import { sha256Hex, sha256Json, canonicalJson } from "./hash.js";
import { isOk, isErr } from "./errors.js";

const emptyEnv = {} as NodeJS.ProcessEnv;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("IPFS local fallback (no PINATA_JWT)", () => {
  it("selects the local backend when unconfigured", () => {
    const client = createIpfsClient(loadInfraConfig(emptyEnv));
    expect(client.backend).toBe("local");
  });

  it("pinJson returns ipfs://mock/<sha256> matching canonical json digest", async () => {
    const client = createIpfsClient(loadInfraConfig(emptyEnv));
    const payload = { b: 2, a: 1 };
    const res = await client.pinJson(payload);

    expect(isOk(res)).toBe(true);
    if (!isOk(res)) return;

    const expectedDigest = sha256Json(payload);
    expect(res.data.backend).toBe("local");
    expect(res.data.uri).toBe(`ipfs://mock/${expectedDigest}`);
    expect(res.data.cid).toBe(`mock/${expectedDigest}`);
    expect(res.data.gatewayUrl.endsWith(`/mock/${expectedDigest}`)).toBe(true);
    expect(res.data.size).toBe(new TextEncoder().encode(canonicalJson(payload)).byteLength);
  });

  it("is deterministic and key-order independent for JSON", async () => {
    const client = createIpfsClient(loadInfraConfig(emptyEnv));
    const a = await client.pinJson({ a: 1, b: { c: 3, d: 4 } });
    const b = await client.pinJson({ b: { d: 4, c: 3 }, a: 1 });
    expect(isOk(a) && isOk(b)).toBe(true);
    if (isOk(a) && isOk(b)) {
      expect(a.data.uri).toBe(b.data.uri);
    }
  });

  it("pinFile returns ipfs://mock/<sha256> of the raw bytes", async () => {
    const client = createIpfsClient(loadInfraConfig(emptyEnv));
    const bytes = new TextEncoder().encode("hello proofchain");
    const res = await client.pinFile(bytes, { name: "doc.txt", contentType: "text/plain" });

    expect(isOk(res)).toBe(true);
    if (!isOk(res)) return;
    expect(res.data.uri).toBe(`ipfs://mock/${sha256Hex(bytes)}`);
    expect(res.data.size).toBe(bytes.byteLength);
  });

  it("rejects empty file bytes with a validation error", async () => {
    const client = createIpfsClient(loadInfraConfig(emptyEnv));
    const res = await client.pinFile(new Uint8Array(0));
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("INFRA_VALIDATION");
  });

  it("module-level pinJson uses env-derived client (local when unset)", async () => {
    const original = process.env.PINATA_JWT;
    delete process.env.PINATA_JWT;
    try {
      const res = await pinJson({ x: 1 });
      expect(isOk(res)).toBe(true);
      if (isOk(res)) expect(res.data.backend).toBe("local");
    } finally {
      if (original !== undefined) process.env.PINATA_JWT = original;
    }
  });
});

describe("IPFS Pinata backend (PINATA_JWT set)", () => {
  const pinataEnv = { PINATA_JWT: "test-jwt" } as NodeJS.ProcessEnv;

  it("selects the pinata backend when configured", () => {
    const client = createIpfsClient(loadInfraConfig(pinataEnv));
    expect(client.backend).toBe("pinata");
  });

  it("pinJson posts to Pinata and maps IpfsHash to an ipfs:// uri", async () => {
    const fetchMock = vi.fn(async (_url: string | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ IpfsHash: "bafyCID", PinSize: 42 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = createIpfsClient(loadInfraConfig(pinataEnv));
    const res = await client.pinJson({ hello: "world" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/pinning/pinJSONToIPFS");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-jwt" });

    expect(isOk(res)).toBe(true);
    if (isOk(res)) {
      expect(res.data.backend).toBe("pinata");
      expect(res.data.uri).toBe("ipfs://bafyCID");
      expect(res.data.size).toBe(42);
    }
  });

  it("pinFile posts multipart to Pinata", async () => {
    const fetchMock = vi.fn(async (_url: string | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ IpfsHash: "bafyFILE" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = createIpfsClient(loadInfraConfig(pinataEnv));
    const res = await client.pinFile(new Uint8Array([1, 2, 3]), { name: "a.bin" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/pinning/pinFileToIPFS");
    expect(init?.body).toBeInstanceOf(FormData);
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.data.uri).toBe("ipfs://bafyFILE");
  });

  it("returns a structured IPFS error on non-2xx responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 401 })),
    );
    const client = createIpfsClient(loadInfraConfig(pinataEnv));
    const res = await client.pinJson({ a: 1 });
    expect(isErr(res)).toBe(true);
    if (isErr(res)) {
      expect(res.error.code).toBe("INFRA_IPFS");
      expect(res.error.details?.status).toBe(401);
    }
  });

  it("returns an error on malformed (non-JSON) Pinata responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>", { status: 200 })),
    );
    const client = createIpfsClient(loadInfraConfig(pinataEnv));
    const res = await client.pinJson({ a: 1 });
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("INFRA_IPFS");
  });

  it("maps thrown fetch errors into a structured envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connection refused");
      }),
    );
    const client = createIpfsClient(loadInfraConfig(pinataEnv));
    const res = await client.pinJson({ a: 1 });
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("INFRA_IPFS");
  });
});
