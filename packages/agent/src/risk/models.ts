/**
 * Risk-lens manifest for the "risk-scoring" Fill category (risk half).
 *
 * Importing this module self-registers every ADVISORY risk lens shipped by this
 * category (credit, counterparty, route, esg, liquidity) into the shared risk
 * registry. It is a deliberate SIBLING to the foundation-owned
 * `src/risk/index.ts` (which registers the builtin `fraud` lens and which this
 * category never edits): an integrator opts the extended lenses into the shared
 * risk registry with a single side-effect import of this manifest, e.g. add
 *
 *   import './risk/models.js';
 *
 * to the service entrypoint (or the verification pipeline) at wiring time. Each
 * lens ALSO self-registers when imported directly, so a unit test can pull in
 * one model in isolation.
 */
import './credit.js';
import './counterparty.js';
import './route.js';
import './esg.js';
import './liquidity.js';

export { creditRiskModel } from './credit.js';
export { counterpartyRiskModel } from './counterparty.js';
export { routeRiskModel } from './route.js';
export { esgRiskModel } from './esg.js';
export { liquidityRiskModel } from './liquidity.js';

/** Ids of every risk lens contributed by this category, in registration order. */
export const RISK_MODEL_IDS = [
  'credit',
  'counterparty',
  'route',
  'esg',
  'liquidity',
] as const;
