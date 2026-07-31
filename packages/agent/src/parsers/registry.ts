/**
 * Document parser registry.
 *
 * A `DocumentParser` teaches the engine about ONE document type: how to detect
 * it, and the zod schema that validates + shapes its extracted fields. The
 * Claude vision extraction step (see anthropic/document-parser.ts) uses the
 * registry to (a) classify a raw document and (b) validate the model's JSON
 * against the doctype-specific schema.
 *
 * REGISTRATION CONVENTION
 *   Create `src/parsers/<doctype>.ts` that builds a `DocumentParser` and calls
 *   `registerParser(...)` at module top level, then add a single side-effect
 *   import line to `src/parsers/index.ts`. Never edit this file.
 */
import { z } from 'zod';
import { createRegistry } from '../registry/registry.js';
import type { DocumentType, ParsedDocumentFields } from '../domain/types.js';

/** A raw document handed to parsers for classification. */
export interface RawDocument {
  readonly name: string;
  readonly mimeType: string;
  /** UTF-8 text content when the document is textual; undefined for binary. */
  readonly text?: string;
  readonly sizeBytes: number;
}

export interface DocumentParser {
  /** Unique doc type id AND registry key, e.g. "invoice". */
  readonly docType: DocumentType;
  /** Human-readable name for UIs/logs. */
  readonly displayName: string;
  /** Domain grouping (trade, logistics, compliance, …) for reporting. */
  readonly domain: string;
  /**
   * Confidence in [0, 1] that this parser handles `raw`. The classifier picks
   * the highest score above `DETECT_THRESHOLD`; ties break by registration
   * order. Return 0 when uncertain.
   */
  detect(raw: RawDocument): number;
  /**
   * Zod schema validating the model-extracted fields for this doc type. Invalid
   * input must fail (throw upstream) rather than be silently coerced.
   */
  readonly schema: z.ZodType<ParsedDocumentFields>;
}

/** Minimum confidence required for `detect` to claim a document. */
export const DETECT_THRESHOLD = 0.3;

/**
 * Shared, lenient field schema every builtin parser reuses. All fields are
 * optional; presence-conditional invariants (e.g. line-item math) live in the
 * cross-check layer, not here. Fill parsers may compose or tighten this.
 */
export const baseFieldsSchema: z.ZodType<ParsedDocumentFields> = z.object({
  total: z.number().optional(),
  currency: z.string().optional(),
  lineItems: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        amount: z.number(),
      }),
    )
    .optional(),
  quantity: z.number().optional(),
  supplierName: z.string().optional(),
  buyerName: z.string().optional(),
  originHash: z.string().optional(),
  date: z.string().optional(),
  parties: z.array(z.string()).optional(),
});

export const parserRegistry = createRegistry<DocumentParser>({
  label: 'document-parser',
  keyOf: (p) => p.docType,
});

/** Register a parser (called by each `src/parsers/<doctype>.ts` module). */
export const registerParser = (parser: DocumentParser): DocumentParser =>
  parserRegistry.register(parser);

/** Every registered document type id, in registration order. */
export const documentTypes = (): readonly DocumentType[] =>
  parserRegistry.keys();

const UNKNOWN: DocumentType = 'unknown';

/**
 * Resolve the effective doc type for a raw document.
 *   1. Honour an explicit, registered `declared` type (from the model).
 *   2. Otherwise classify by the best `detect` score above threshold.
 *   3. Fall back to "unknown".
 */
export const resolveDocType = (
  declared: string | undefined,
  raw: RawDocument,
): DocumentType => {
  if (declared !== undefined && parserRegistry.has(declared)) {
    return declared;
  }
  let best: { docType: DocumentType; score: number } | undefined;
  for (const parser of parserRegistry.all()) {
    const score = clampConfidence(parser.detect(raw));
    if (score >= DETECT_THRESHOLD && (best === undefined || score > best.score)) {
      best = { docType: parser.docType, score };
    }
  }
  return best?.docType ?? UNKNOWN;
};

/** Return the parser for a doc type, falling back to the "unknown" parser. */
export const parserFor = (docType: DocumentType): DocumentParser =>
  parserRegistry.get(docType) ?? parserRegistry.require(UNKNOWN);

const clampConfidence = (n: number): number => {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
};
