/**
 * Delivery note parser. Recognises proof-of-delivery / goods-received documents
 * that close the logistics loop — consumed by the last-mile cross-check and the
 * quantity reconciliation.
 */
import { keywordScore } from './detect.js';
import { baseFieldsSchema, registerParser } from './registry.js';

const KEYWORDS = [
  'delivery note',
  'delivery order',
  'proof of delivery',
  'goods received',
  'consignment note',
  'received by',
  'delivered to',
];

export const deliveryNoteParser = registerParser({
  docType: 'delivery_note',
  displayName: 'Delivery Note',
  domain: 'logistics',
  detect: (raw) => keywordScore(raw, KEYWORDS),
  schema: baseFieldsSchema,
});
