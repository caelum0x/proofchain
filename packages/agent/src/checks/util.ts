/**
 * Shared, pure helpers for the domain cross-check rule packs.
 *
 * Every rule pack under `src/checks/<domain>.ts` builds on these primitives so
 * comparison semantics (money tolerance, name normalisation, currency codes,
 * date parsing) stay identical across packs and matches the builtin core rules.
 * Nothing here performs IO or reads a clock — checks must be pure so the verdict
 * is reproducible.
 */
import { z } from 'zod';
import type { ParsedDocument, DocumentType } from '../domain/types.js';

/** A finite, real number (rejects NaN/Infinity) — used to guard comparisons. */
export const finiteNumberSchema = z.number().finite();

/** True when `v` is a usable finite number. */
export const isFiniteNumber = (v: unknown): v is number =>
  finiteNumberSchema.safeParse(v).success;

/**
 * Two monetary values are "equal" within 0.5% relative OR 1 cent absolute —
 * the same tolerance the core invoice rules use. Non-finite inputs are treated
 * as unequal (they cannot be reconciled).
 */
export const moneyEqual = (a: number, b: number): boolean => {
  if (!isFiniteNumber(a) || !isFiniteNumber(b)) return false;
  const diff = Math.abs(a - b);
  if (diff <= 0.01) return true;
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return diff / scale <= 0.005;
};

/** Normalise a party/entity name for comparison: trim, lowercase, collapse ws. */
export const normName = (s: string): string =>
  s.trim().toLowerCase().replace(/\s+/g, ' ');

/** An ISO-4217-shaped currency code is exactly three ASCII letters. */
export const isCurrencyCode = (raw: string): boolean =>
  /^[A-Za-z]{3}$/.test(raw.trim());

/** Uppercased currency code (for consistency comparisons). */
export const normCurrency = (raw: string): string => raw.trim().toUpperCase();

/** All documents of a given resolved doc type. */
export const docsOfType = (
  docs: readonly ParsedDocument[],
  type: DocumentType,
): ParsedDocument[] => docs.filter((d) => d.docType === type);

/** The first document of a given type, if any. */
export const firstOfType = (
  docs: readonly ParsedDocument[],
  type: DocumentType,
): ParsedDocument | undefined => docs.find((d) => d.docType === type);

/** True when at least one document has the given type. */
export const hasType = (
  docs: readonly ParsedDocument[],
  type: DocumentType,
): boolean => docs.some((d) => d.docType === type);

/**
 * Parse an ISO-8601 date string to unix seconds. Returns undefined for missing
 * or unparseable input so callers can distinguish "absent" from "invalid".
 */
export const toUnixSeconds = (iso: string | undefined): number | undefined => {
  if (iso === undefined) return undefined;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
};

/**
 * Collect every distinct party/entity name a document names — supplier, buyer,
 * and the free-form `parties[]` list — already normalised.
 */
export const partyNames = (doc: ParsedDocument): string[] => {
  const raw: (string | undefined)[] = [
    doc.fields.supplierName,
    doc.fields.buyerName,
    ...(doc.fields.parties ?? []),
  ];
  const names = raw
    .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
    .map(normName);
  return [...new Set(names)];
};

/** Sum of a document's line-item amounts, or undefined when it has no items. */
export const lineItemTotal = (doc: ParsedDocument): number | undefined => {
  const items = doc.fields.lineItems;
  if (items === undefined || items.length === 0) return undefined;
  return items.reduce((acc, li) => acc + li.amount, 0);
};
