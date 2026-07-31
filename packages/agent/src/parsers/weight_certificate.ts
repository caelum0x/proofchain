/**
 * Weight certificate parser. Recognises weighbridge / certificate-of-weight
 * documents establishing net, gross and tare weights — the authoritative
 * quantity source for the weight and quantity cross-checks.
 */
import { keywordScore } from './detect.js';
import { baseFieldsSchema, registerParser } from './registry.js';

const KEYWORDS = [
  'weight certificate',
  'certificate of weight',
  'weighbridge',
  'weighing',
  'tare weight',
  'net weight',
  'gross weight',
];

export const weightCertificateParser = registerParser({
  docType: 'weight_certificate',
  displayName: 'Weight Certificate',
  domain: 'logistics',
  detect: (raw) => keywordScore(raw, KEYWORDS),
  schema: baseFieldsSchema,
});
