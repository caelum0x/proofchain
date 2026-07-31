/**
 * Dimension manifest for the "risk-scoring" Fill category (scoring half).
 *
 * Importing this module self-registers every additional scoring DIMENSION
 * shipped by this category (authenticity, consistency, compliance, completeness,
 * esg, risk) plus the `reconciled` reconciler, into the shared scorer registry.
 * It is a deliberate SIBLING to the foundation-owned `src/scoring/index.ts`
 * (which registers the builtin `model` + `rules` dimensions and which this
 * category never edits): an integrator opts the extended dimensions into the
 * pipeline's reconciliation with a single side-effect import of this manifest,
 * e.g. add
 *
 *   import './scoring/dimensions.js';
 *
 * to the service entrypoint at wiring time. Under the registry's strict-min
 * aggregation these dimensions can only make a verdict STRICTER; each also
 * self-registers when imported directly for tests.
 */
import './authenticity.js';
import './consistency.js';
import './compliance.js';
import './completeness.js';
import './esg.js';
import './risk.js';
import './reconciler.js';

export { authenticityScorer } from './authenticity.js';
export { consistencyScorer } from './consistency.js';
export { complianceScorer } from './compliance.js';
export { completenessScorer } from './completeness.js';
export { esgScorer } from './esg.js';
export { riskScorer } from './risk.js';
export { reconcilerScorer } from './reconciler.js';

/** Dimension ids contributed by this category, in registration order. */
export const EXTENDED_DIMENSIONS = [
  'authenticity',
  'consistency',
  'compliance',
  'completeness',
  'esg',
  'risk',
  'reconciled',
] as const;
