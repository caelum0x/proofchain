/**
 * Small, reusable detection helpers for builtin parsers. Keeps the individual
 * `<doctype>.ts` files declarative.
 */
import type { RawDocument } from './registry.js';

/** Lowercased "haystack" of a document's name + text, for keyword matching. */
export const haystack = (raw: RawDocument): string =>
  `${raw.name}\n${raw.text ?? ''}`.toLowerCase();

/**
 * Score a document by keyword hits. Each distinct keyword found contributes
 * evenly toward a capped confidence. A name hit is weighted a little higher
 * than a body hit because filenames are usually authoritative.
 */
export const keywordScore = (
  raw: RawDocument,
  keywords: readonly string[],
): number => {
  const name = raw.name.toLowerCase();
  const body = (raw.text ?? '').toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    const k = kw.toLowerCase();
    if (name.includes(k)) score += 0.6;
    else if (body.includes(k)) score += 0.3;
  }
  return Math.min(1, score);
};
