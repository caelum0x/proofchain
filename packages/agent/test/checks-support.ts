/**
 * Shared helpers for the domain cross-check pack tests. Offline-only: builds
 * `ParsedDocument`s and runs a pack's checks against a `CrossCheckInput`.
 */
import type { CrossCheck } from '../src/checks/registry.js';
import type {
  CrossCheckInput,
  DocumentType,
  ParsedDocument,
  ParsedDocumentFields,
} from '../src/domain/types.js';
import type { Finding } from '../src/shared.js';
import { sampleProvenance, invoiceDoc } from './helpers.js';

/** Build a parsed document of any type with the given fields. */
export const makeDoc = (
  docType: DocumentType,
  fields: ParsedDocumentFields = {},
  over: Partial<ParsedDocument> = {},
): ParsedDocument => ({
  index: 0,
  name: `${docType}.pdf`,
  docType,
  sha256: 'f'.repeat(64),
  fields,
  ...over,
});

/** Run every check in a pack and flatten the findings (registration order). */
export const runPack = (
  pack: readonly CrossCheck[],
  input: CrossCheckInput,
): Finding[] => pack.flatMap((c) => c.run(input));

export const codesOf = (findings: readonly Finding[]): string[] =>
  findings.map((f) => f.code);

/** A minimal, clean commercial input every pack must be silent on. */
export const cleanInput = (): CrossCheckInput => ({
  provenance: sampleProvenance(),
  documents: [invoiceDoc()],
});
