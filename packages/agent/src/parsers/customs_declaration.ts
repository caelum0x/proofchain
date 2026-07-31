/**
 * Customs declaration parser. Recognises the import/export declaration (SAD)
 * carrying HS codes and declared values that the customs and duty cross-checks
 * validate against the invoice.
 */
import { keywordScore } from './detect.js';
import { baseFieldsSchema, registerParser } from './registry.js';

const KEYWORDS = [
  'customs declaration',
  'single administrative document',
  'import declaration',
  'export declaration',
  'hs code',
  'tariff',
  'declared value',
  'customs',
];

export const customsDeclarationParser = registerParser({
  docType: 'customs_declaration',
  displayName: 'Customs Declaration',
  domain: 'customs',
  detect: (raw) => keywordScore(raw, KEYWORDS),
  schema: baseFieldsSchema,
});
