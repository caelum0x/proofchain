/**
 * Lab report parser. Recognises laboratory analysis / certificate-of-analysis
 * documents (assays, composition, purity) that feed the quality cross-check and
 * DPP material-composition completeness scoring.
 */
import { keywordScore } from './detect.js';
import { baseFieldsSchema, registerParser } from './registry.js';

const KEYWORDS = [
  'laboratory report',
  'lab report',
  'test report',
  'certificate of analysis',
  'analysis report',
  'assay',
  'coa',
];

export const labReportParser = registerParser({
  docType: 'lab_report',
  displayName: 'Laboratory Report',
  domain: 'quality',
  detect: (raw) => keywordScore(raw, KEYWORDS),
  schema: baseFieldsSchema,
});
