import { describe, it, expect } from "vitest";
import { createS3StorageAdapter } from "./s3.js";
import { loadInfraConfig } from "../../env.js";
import { isOk } from "../../errors.js";

const s3Env = {
  S3_BUCKET: "my-bucket",
  S3_ACCESS_KEY_ID: "AKID",
  S3_SECRET_ACCESS_KEY: "secret",
  S3_REGION: "us-east-1",
  S3_ENDPOINT: "https://s3.example.com",
} as NodeJS.ProcessEnv;

const fixedNow = () => new Date("2026-07-31T00:00:00Z");

interface Call {
  url: string;
  init: RequestInit;
}

function recorder(response: () => Response) {
  const calls: Call[] = [];
  const fetchFn = async (url: string, init: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    return response();
  };
  return { calls, fetchFn };
}

describe("S3 storage adapter", () => {
  it("signs and PUTs an object", async () => {
    const { calls, fetchFn } = recorder(() => new Response(null, { status: 200 }));
    const adapter = createS3StorageAdapter(loadInfraConfig(s3Env), { fetch: fetchFn, now: fixedNow });

    const res = await adapter.put("path/to/obj.txt", new TextEncoder().encode("hi"), {
      contentType: "text/plain",
    });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) {
      expect(res.data.uri).toBe("s3://my-bucket/path/to/obj.txt");
      expect(res.data.backend).toBe("s3");
    }
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://s3.example.com/my-bucket/path/to/obj.txt");
    expect(calls[0]?.init.method).toBe("PUT");
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.Authorization).toContain("AWS4-HMAC-SHA256");
    expect(headers["x-amz-content-sha256"]).toBeDefined();
  });

  it("GET returns bytes, and null on 404", async () => {
    const okAdapter = createS3StorageAdapter(loadInfraConfig(s3Env), {
      fetch: async () => new Response("data", { status: 200 }),
      now: fixedNow,
    });
    const got = await okAdapter.get("k");
    if (isOk(got)) expect(new TextDecoder().decode(got.data!)).toBe("data");

    const missAdapter = createS3StorageAdapter(loadInfraConfig(s3Env), {
      fetch: async () => new Response(null, { status: 404 }),
      now: fixedNow,
    });
    const miss = await missAdapter.get("k");
    if (isOk(miss)) expect(miss.data).toBeNull();
  });

  it("exists reflects 200 vs 404 and delete tolerates 404", async () => {
    const present = createS3StorageAdapter(loadInfraConfig(s3Env), {
      fetch: async () => new Response(null, { status: 200 }),
      now: fixedNow,
    });
    expect((await present.exists("k")).data).toBe(true);

    const absent = createS3StorageAdapter(loadInfraConfig(s3Env), {
      fetch: async () => new Response(null, { status: 404 }),
      now: fixedNow,
    });
    expect((await absent.exists("k")).data).toBe(false);
    expect((await absent.delete("k")).data).toBe(true);
  });

  it("falls back to the local adapter when S3 is unconfigured", async () => {
    const adapter = createS3StorageAdapter(loadInfraConfig({} as NodeJS.ProcessEnv));
    expect(adapter.backend).toBe("local");
    const put = await adapter.put("k", new Uint8Array([1, 2, 3]));
    expect(isOk(put)).toBe(true);
  });
});
