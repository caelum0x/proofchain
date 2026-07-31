/**
 * Fallback "unknown" parser. Always registered so `resolveDocType`/`parserFor`
 * have a total function even when nothing else matches. Never claims a document
 * during detection (score 0) — it only serves as the default.
 */
import { baseFieldsSchema, registerParser } from './registry.js';

export const genericParser = registerParser({
  docType: 'unknown',
  displayName: 'Unclassified Document',
  domain: 'general',
  detect: () => 0,
  schema: baseFieldsSchema,
});
