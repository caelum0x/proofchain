/**
 * Pipeline barrel — the auto-collection manifest.
 *
 * Importing this module registers the builtin verification pipeline. Fill agents
 * add a flow by creating `src/pipelines/<flow>.ts` (which calls
 * `registerPipeline`) and APPENDING one side-effect import line below. The
 * registry itself is never edited.
 */
import './verification.js';
import './financing_eligibility.js';
import './insurance_underwriting.js';
import './dpp_issuance.js';
import './compliance_screening.js';
import './quality_grading.js';
import './esg_assessment.js';
import './credit_scoring.js';

export * from './registry.js';
export * from './verification.js';
export * from './assessment.js';
export * from './decision.js';
export * from './financing_eligibility.js';
export * from './insurance_underwriting.js';
export * from './dpp_issuance.js';
export * from './compliance_screening.js';
export * from './quality_grading.js';
export * from './esg_assessment.js';
export * from './credit_scoring.js';
