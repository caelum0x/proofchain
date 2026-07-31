/**
 * Dangerous goods declaration parser. Recognises IMDG/IATA hazardous-cargo
 * declarations (UN numbers, hazard class) required for regulated shipments — an
 * input to the compliance-screening pipeline and route risk model.
 */
import { keywordScore } from './detect.js';
import { baseFieldsSchema, registerParser } from './registry.js';

const KEYWORDS = [
  'dangerous goods declaration',
  'dangerous goods',
  'hazardous',
  'hazmat',
  'un number',
  'imo',
  'hazard class',
];

export const dangerousGoodsParser = registerParser({
  docType: 'dangerous_goods',
  displayName: 'Dangerous Goods Declaration',
  domain: 'logistics',
  detect: (raw) => keywordScore(raw, KEYWORDS),
  schema: baseFieldsSchema,
});
