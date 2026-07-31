import { describe, it, expect } from "vitest";
import { TtlCache } from "./ttl.js";

function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("TtlCache", () => {
  it("stores and retrieves live values", () => {
    const c = clock();
    const cache = new TtlCache<string, number>({ ttlMs: 1000, now: c.now });
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    expect(cache.has("a")).toBe(true);
    expect(cache.size).toBe(1);
  });

  it("expires entries after the TTL", () => {
    const c = clock();
    const cache = new TtlCache<string, number>({ ttlMs: 1000, now: c.now });
    cache.set("a", 1);
    c.advance(999);
    expect(cache.get("a")).toBe(1);
    c.advance(1);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("honours a per-entry TTL override", () => {
    const c = clock();
    const cache = new TtlCache<string, number>({ ttlMs: 1000, now: c.now });
    cache.set("a", 1, 50);
    c.advance(51);
    expect(cache.get("a")).toBeUndefined();
  });

  it("evicts oldest entries when maxSize is exceeded", () => {
    const c = clock();
    const cache = new TtlCache<string, number>({ ttlMs: 1000, maxSize: 2, now: c.now });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });

  it("getOrSet computes and caches once", async () => {
    const c = clock();
    const cache = new TtlCache<string, number>({ ttlMs: 1000, now: c.now });
    let calls = 0;
    const factory = async () => {
      calls += 1;
      return 42;
    };
    expect(await cache.getOrSet("k", factory)).toBe(42);
    expect(await cache.getOrSet("k", factory)).toBe(42);
    expect(calls).toBe(1);
  });

  it("delete and clear work; invalid options throw", () => {
    const cache = new TtlCache<string, number>({ ttlMs: 1000 });
    cache.set("a", 1);
    expect(cache.delete("a")).toBe(true);
    expect(cache.delete("a")).toBe(false);
    cache.set("b", 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(() => new TtlCache<string, number>({ ttlMs: 0 })).toThrow();
    expect(() => new TtlCache<string, number>({ ttlMs: 1000, maxSize: 0 })).toThrow();
  });
});
