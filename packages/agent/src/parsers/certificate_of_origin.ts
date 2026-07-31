/**
 * Certificate of origin parser. Recognises the compliance document that attests
 * the country of manufacture — consumed by the customs/sanctions cross-checks to
 * confirm the declared origin matches on-chain provenance.
 */
import { keywordScore } from './detect.js';
import { baseFieldsSchema, registerParser } from './registry.js';

const KEYWORDS = [
  'certificate of origin',
  'country of origin',
  'origin criterion',
  'chamber of commerce',
  'certificate no',
  'eur.1',
  'form a',
];

export const certificateOfOriginParser = registerParser({
  docType: 'certificate_of_origin',
  displayName: 'Certificate of Origin',
  domain: 'compliance',
  detect: (raw) => keywordScore(raw, KEYWORDS),
  schema: baseFieldsSchema,
});
