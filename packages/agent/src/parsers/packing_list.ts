/**
 * Packing list parser. Recognises the itemised packing document that enumerates
 * cartons/packages and their net/gross weights — the quantity source the trade
 * and quantity cross-checks reconcile against the invoice and bill of lading.
 */
import { keywordScore } from './detect.js';
import { baseFieldsSchema, registerParser } from './registry.js';

const KEYWORDS = [
  'packing list',
  'packing slip',
  'pkg list',
  'number of packages',
  'total packages',
  'carton',
  'net weight',
  'gross weight',
];

export const packingListParser = registerParser({
  docType: 'packing_list',
  displayName: 'Packing List',
  domain: 'logistics',
  detect: (raw) => keywordScore(raw, KEYWORDS),
  schema: baseFieldsSchema,
});
