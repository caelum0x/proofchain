/**
 * Bill of lading parser. Recognises ocean/air B/L transport documents that
 * establish quantity and the shipper/consignee parties.
 */
import { keywordScore } from './detect.js';
import { baseFieldsSchema, registerParser } from './registry.js';

const KEYWORDS = [
  'bill of lading',
  'b/l',
  'bol',
  'shipper',
  'consignee',
  'port of loading',
  'vessel',
];

export const billOfLadingParser = registerParser({
  docType: 'bill_of_lading',
  displayName: 'Bill of Lading',
  domain: 'logistics',
  detect: (raw) => keywordScore(raw, KEYWORDS),
  schema: baseFieldsSchema,
});
