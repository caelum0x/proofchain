/**
 * Simple, dependency-free in-memory TTL cache.
 *
 * Entries expire after a per-cache (or per-entry) time-to-live and are evicted
 * lazily on access plus eagerly when an optional `maxSize` is exceeded (oldest
 * insertion first). The clock is injectable for deterministic tests.
 *
 * Cache operations never fail, so they return plain values rather than the
 * package `Result` envelope.
 */
export interface TtlCacheOptions {
  /** Default time-to-live for entries, in milliseconds. */
  readonly ttlMs: number;
  /** Optional cap on the number of live entries (evicts oldest first). */
  readonly maxSize?: number;
  /** Injectable clock (defaults to `Date.now`). */
  readonly now?: () => number;
}

interface Entry<V> {
  readonly value: V;
  readonly expiresAt: number;
}

export class TtlCache<K, V> {
  private readonly store = new Map<K, Entry<V>>();
  private readonly ttlMs: number;
  private readonly maxSize: number | undefined;
  private readonly now: () => number;

  constructor(options: TtlCacheOptions) {
    if (!Number.isFinite(options.ttlMs) || options.ttlMs <= 0) {
      throw new Error("TtlCache: ttlMs must be a positive number");
    }
    if (options.maxSize !== undefined && options.maxSize <= 0) {
      throw new Error("TtlCache: maxSize must be a positive number when provided");
    }
    this.ttlMs = options.ttlMs;
    this.maxSize = options.maxSize;
    this.now = options.now ?? Date.now;
  }

  /** Number of live (non-expired) entries. */
  get size(): number {
    this.purgeExpired();
    return this.store.size;
  }

  /** Fetch a live value, or `undefined` if absent/expired. */
  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (entry === undefined) return undefined;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /** Whether a live value exists for `key`. */
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  /** Insert/replace a value with an optional per-entry TTL override. */
  set(key: K, value: V, ttlMs?: number): void {
    const ttl = ttlMs ?? this.ttlMs;
    // Re-insert to move the key to the tail for oldest-first eviction ordering.
    this.store.delete(key);
    this.store.set(key, { value, expiresAt: this.now() + ttl });
    this.enforceMaxSize();
  }

  /** Return the cached value or compute, cache, and return it. */
  async getOrSet(
    key: K,
    factory: () => V | Promise<V>,
    ttlMs?: number,
  ): Promise<V> {
    const existing = this.get(key);
    if (existing !== undefined) return existing;
    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  /** Remove a single key. Returns whether it was present (and live). */
  delete(key: K): boolean {
    const had = this.get(key) !== undefined;
    this.store.delete(key);
    return had;
  }

  /** Remove all entries. */
  clear(): void {
    this.store.clear();
  }

  // ---------------------------------------------------------------------------

  private isExpired(entry: Entry<V>): boolean {
    return entry.expiresAt <= this.now();
  }

  private purgeExpired(): void {
    for (const [key, entry] of this.store) {
      if (this.isExpired(entry)) this.store.delete(key);
    }
  }

  private enforceMaxSize(): void {
    if (this.maxSize === undefined) return;
    this.purgeExpired();
    while (this.store.size > this.maxSize) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }
}
