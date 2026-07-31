/**
 * Inspection report parser. Recognises pre-shipment / quality inspection
 * certificates that attest goods were examined and conform — an input to the
 * quality cross-check and the authenticity scorer.
 */
import { keywordScore } from './detect.js';
import { baseFieldsSchema, registerParser } from './registry.js';

const KEYWORDS = [
  'inspection report',
  'inspection certificate',
  'pre-shipment inspection',
  'quality inspection',
  'inspected by',
  'inspection date',
];

export const inspectionReportParser = registerParser({
  docType: 'inspection_report',
  displayName: 'Inspection Report',
  domain: 'quality',
  detect: (raw) => keywordScore(raw, KEYWORDS),
  schema: baseFieldsSchema,
});
