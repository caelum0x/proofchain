/**
 * Halal certificate parser. Recognises halal certification attesting compliance
 * with Islamic dietary law — a compliance-screening input for food and consumer
 * goods shipments.
 */
import { keywordScore } from './detect.js';
import { baseFieldsSchema, registerParser } from './registry.js';

const KEYWORDS = [
  'halal certificate',
  'halal certification',
  'halal',
  'shariah',
  'zabihah',
];

export const halalCertParser = registerParser({
  docType: 'halal_cert',
  displayName: 'Halal Certificate',
  domain: 'compliance',
  detect: (raw) => keywordScore(raw, KEYWORDS),
  schema: baseFieldsSchema,
});
