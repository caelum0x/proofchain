/**
 * Insurance certificate parser. Recognises marine/cargo certificates of
 * insurance that establish coverage and the insured sum — a required input to
 * the insurance-underwriting pipeline and trade cross-checks.
 */
import { keywordScore } from './detect.js';
import { baseFieldsSchema, registerParser } from './registry.js';

const KEYWORDS = [
  'certificate of insurance',
  'insurance certificate',
  'marine insurance',
  'cargo insurance',
  'sum insured',
  'policy no',
  'insured',
  'insurer',
];

export const insuranceCertParser = registerParser({
  docType: 'insurance_cert',
  displayName: 'Insurance Certificate',
  domain: 'insurance',
  detect: (raw) => keywordScore(raw, KEYWORDS),
  schema: baseFieldsSchema,
});
