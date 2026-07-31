/**
 * Cold chain log parser. Recognises temperature data-logger records for reefer /
 * cold-storage shipments — the evidence the cold-chain cross-check and
 * parametric insurance underwriting evaluate for temperature excursions.
 */
import { keywordScore } from './detect.js';
import { baseFieldsSchema, registerParser } from './registry.js';

const KEYWORDS = [
  'cold chain',
  'temperature log',
  'temperature record',
  'temperature excursion',
  'data logger',
  'reefer',
  'cold storage',
];

export const coldChainLogParser = registerParser({
  docType: 'cold_chain_log',
  displayName: 'Cold Chain Log',
  domain: 'logistics',
  detect: (raw) => keywordScore(raw, KEYWORDS),
  schema: baseFieldsSchema,
});
