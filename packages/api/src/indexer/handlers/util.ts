/**
 * Small, pure helpers shared by the projecting domain handlers.
 *
 * Projectors read loosely-typed, JSON-safe event args (viem returns `number` for
 * uint8..uint48 — enums included — and, after `jsonSafe`, base-10 `string` for
 * uint56+/uint256). These helpers narrow those values safely and normalize
 * on-chain identifiers/timestamps to the shapes the read-model columns expect.
 * They never throw: a malformed field yields `undefined`/`null` so a handler can
 * log-and-skip (audit-only) rather than abort the range.
 */

/** Narrow a value to `string`, else `undefined`. */
export const str = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : undefined;

/** Narrow a value to a lowercased `string` (hex address/id), else `undefined`. */
export const lower = (v: unknown): string | undefined =>
  typeof v === 'string' ? v.toLowerCase() : undefined;

/**
 * Narrow an integer-ish arg to a finite `number`. Accepts a native `number`
 * (small uints/enums) or a base-10 `string` (large uints). Returns `undefined`
 * for anything non-numeric so callers can branch defensively.
 */
export const asNumber = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

/**
 * Convert a unix-seconds value (native `number` or base-10 `string`) into an ISO
 * timestamp string suitable for a `timestamptz` column, or `null` when the value
 * is absent, zero, or unparseable (a common "no expiry" sentinel on-chain).
 */
export const secondsToIso = (v: unknown): string | null => {
  const seconds = asNumber(v);
  if (seconds === undefined || seconds <= 0) return null;
  const ms = seconds * 1000;
  if (!Number.isFinite(ms)) return null;
  const iso = new Date(ms);
  return Number.isNaN(iso.getTime()) ? null : iso.toISOString();
};

/**
 * Pick a value from a frozen enum→label map by numeric key and lowercase it to
 * the snake/lower token the read-model CHECK constraints use, falling back to
 * `fallback` for an out-of-range/unknown value so a write never violates a CHECK.
 */
export const enumToken = (
  labels: Readonly<Record<number, string>>,
  value: unknown,
  fallback: string,
): string => {
  const key = asNumber(value);
  if (key === undefined) return fallback;
  const label = labels[key];
  return typeof label === 'string' ? label.toLowerCase() : fallback;
};
