/**
 * Shared, dependency-free helpers for the extended agent tools.
 *
 * The tool-calling loop's `ToolHandlerContext` only exposes what is knowable
 * about the batch under verification (provenance + parsed documents). Tools that
 * answer questions about EXTERNAL reference data (reputation, sanctions, KYC,
 * policy, receivables, ESG, prior attestations) therefore back onto small
 * IN-MEMORY stores here. These are:
 *   - deterministic and offline (no network, no clock) so the suite is
 *     reproducible and tests never flake, and
 *   - seedable, so a real deployment (or a test) can inject records sourced from
 *     Supabase / an oracle without changing any tool code.
 * When a store has no record for a key, tools fall back to a DETERMINISTIC
 * derivation (see `deterministicBps`) — never a dead stub, always a real answer.
 */

/** 0x-prefixed 32-byte hex (a batchId / hash). */
export const HEX32 = /^0x[0-9a-fA-F]{64}$/;

/** 0x-prefixed 20-byte hex (an address). */
export const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** Canonical store key: trimmed + lowercased (hex is case-insensitive). */
export const normalizeKey = (value: string): string =>
  value.trim().toLowerCase();

/** Canonical party name: trimmed, lowercased, internal whitespace collapsed. */
export const normalizeParty = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * FNV-1a 32-bit hash of a seed string mapped into basis points [0, 10000].
 * Stable across runs and platforms (pure integer math), so a "derived" answer
 * for the same key is always identical — the property tests rely on this.
 */
export const deterministicBps = (seed: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 10_001;
};

/** Clamp any number into the basis-point domain [0, 10000] as an integer. */
export const clampBps = (n: number): number =>
  Math.max(0, Math.min(10_000, Math.round(n)));

/** Coarse A–F grade for a cleanliness/quality score in bps (higher = better). */
export const gradeOf = (bps: number): 'A' | 'B' | 'C' | 'D' | 'F' => {
  if (bps >= 8_000) return 'A';
  if (bps >= 6_000) return 'B';
  if (bps >= 4_000) return 'C';
  if (bps >= 2_000) return 'D';
  return 'F';
};

/** A seedable, resettable in-memory key/value store (test-friendly). */
export interface RefStore<T> {
  /** Insert/replace a record. `reset()` clears everything (test-only). */
  seed(key: string, value: T): void;
  get(key: string): T | undefined;
  has(key: string): boolean;
  reset(): void;
}

/** Build an empty {@link RefStore}. Keys are normalized via {@link normalizeKey}. */
export const createStore = <T>(): RefStore<T> => {
  const map = new Map<string, T>();
  return {
    seed: (key, value) => {
      map.set(normalizeKey(key), value);
    },
    get: (key) => map.get(normalizeKey(key)),
    has: (key) => map.has(normalizeKey(key)),
    reset: () => map.clear(),
  };
};
