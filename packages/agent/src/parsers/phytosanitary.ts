/**
 * Phytosanitary certificate parser. Recognises IPPC plant-health certificates
 * required for agricultural shipments — an input to the compliance-screening
 * pipeline and the customs cross-check.
 */
import { keywordScore } from './detect.js';
import { baseFieldsSchema, registerParser } from './registry.js';

const KEYWORDS = [
  'phytosanitary certificate',
  'phytosanitary',
  'plant protection',
  'plant health',
  'ippc',
  'fumigation',
];

export const phytosanitaryParser = registerParser({
  docType: 'phytosanitary',
  displayName: 'Phytosanitary Certificate',
  domain: 'compliance',
  detect: (raw) => keywordScore(raw, KEYWORDS),
  schema: baseFieldsSchema,
});
