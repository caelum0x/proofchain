/**
 * Letter of credit parser. Recognises documentary credits (UCP 600) issued by a
 * bank in favour of a beneficiary — the anchor document for the
 * financing-eligibility pipeline and trade-finance cross-checks.
 */
import { keywordScore } from './detect.js';
import { baseFieldsSchema, registerParser } from './registry.js';

const KEYWORDS = [
  'letter of credit',
  'documentary credit',
  'irrevocable',
  'issuing bank',
  'beneficiary',
  'ucp 600',
  'l/c no',
];

export const letterOfCreditParser = registerParser({
  docType: 'letter_of_credit',
  displayName: 'Letter of Credit',
  domain: 'trade',
  detect: (raw) => keywordScore(raw, KEYWORDS),
  schema: baseFieldsSchema,
});
