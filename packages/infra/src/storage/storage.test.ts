import { describe, it, expect } from "vitest";
import {
  createStorage,
  createStorageAdapter,
  registeredStorageAdapters,
} from "./index.js";
import { loadInfraConfig } from "../env.js";
import { isOk, isErr } from "../errors.js";

const emptyConfig = loadInfraConfig({} as NodeJS.ProcessEnv);

describe("storage — registry + local backend", () => {
  it("registers the built-in adapters", () => {
    const names = registeredStorageAdapters();
    expect(names).toContain("local");
    expect(names).toContain("s3");
    expect(names).toContain("ipfs");
  });

  it("auto-selects local when nothing is configured", () => {
    expect(createStorage(emptyConfig).backend).toBe("local");
  });

  it("throws for an unknown adapter", () => {
    expect(() => createStorageAdapter("does-not-exist", emptyConfig)).toThrow();
  });

  it("round-trips bytes and JSON through the local adapter", async () => {
    const store = createStorage(emptyConfig);
    const bytes = new TextEncoder().encode("hello");

    const put = await store.put("k/1", bytes, { contentType: "text/plain" });
    expect(isOk(put)).toBe(true);
    if (isOk(put)) {
      expect(put.data.uri).toBe("mem://k/1");
      expect(put.data.size).toBe(5);
    }

    expect((await store.exists("k/1")).data).toBe(true);
    const got = await store.get("k/1");
    if (isOk(got)) expect(new TextDecoder().decode(got.data ?? new Uint8Array())).toBe("hello");

    const putJson = await store.putJson("k/2", { a: 1 });
    expect(isOk(putJson)).toBe(true);
    const gotJson = await store.get("k/2");
    if (isOk(gotJson)) expect(JSON.parse(new TextDecoder().decode(gotJson.data!))).toEqual({ a: 1 });

    await store.delete("k/1");
    expect((await store.exists("k/1")).data).toBe(false);
    expect((await store.get("missing")).data).toBeNull();
  });

  it("rejects an empty key", async () => {
    const store = createStorage(emptyConfig);
    const res = await store.put("", new Uint8Array([1]));
    expect(isErr(res)).toBe(true);
  });
});

describe("storage — ipfs adapter (local mock fallback)", () => {
  it("pins JSON to an ipfs:// mock uri and rejects reads", async () => {
    const ipfs = createStorageAdapter("ipfs", emptyConfig);
    const pinned = await ipfs.putJson("meta", { hello: "world" });
    expect(isOk(pinned)).toBe(true);
    if (isOk(pinned)) expect(pinned.data.uri.startsWith("ipfs://")).toBe(true);

    const read = await ipfs.get("whatever");
    expect(isErr(read)).toBe(true);
  });
});
