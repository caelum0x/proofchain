/**
 * Invoice parser. Recognises commercial invoices and validates the monetary
 * fields the trade cross-checks rely on (total, line items).
 */
import { keywordScore } from './detect.js';
import { baseFieldsSchema, registerParser } from './registry.js';

const KEYWORDS = ['invoice', 'commercial invoice', 'inv-', 'bill to', 'sold to'];

export const invoiceParser = registerParser({
  docType: 'invoice',
  displayName: 'Commercial Invoice',
  domain: 'trade',
  detect: (raw) => keywordScore(raw, KEYWORDS),
  schema: baseFieldsSchema,
});
