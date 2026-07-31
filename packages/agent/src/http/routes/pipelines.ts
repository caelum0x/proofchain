/**
 * Mounts every domain-pipeline route plus the shared list and jobs endpoints.
 * The side-effect import of the pipelines barrel guarantees all pipelines are
 * registered before any route resolves them from the registry.
 */
import type { FastifyInstance } from 'fastify';
// Side-effect import: registers all pipelines into the pipeline registry.
import '../../pipelines/index.js';
import {
  registerPipelineJobsRoute,
  registerPipelineListRoute,
} from './pipeline-runner.js';
import { registerFinancingEligibilityRoute } from './financing_eligibility.js';
import { registerInsuranceUnderwritingRoute } from './insurance_underwriting.js';
import { registerDppIssuanceRoute } from './dpp_issuance.js';
import { registerComplianceScreeningRoute } from './compliance_screening.js';
import { registerQualityGradingRoute } from './quality_grading.js';
import { registerEsgAssessmentRoute } from './esg_assessment.js';
import { registerCreditScoringRoute } from './credit_scoring.js';
import type { PipelineHttpDeps } from '../pipeline-deps.js';

export const registerPipelineRoutes = (
  app: FastifyInstance,
  deps: PipelineHttpDeps,
): void => {
  registerPipelineListRoute(app);
  registerFinancingEligibilityRoute(app, deps);
  registerInsuranceUnderwritingRoute(app, deps);
  registerDppIssuanceRoute(app, deps);
  registerComplianceScreeningRoute(app, deps);
  registerQualityGradingRoute(app, deps);
  registerEsgAssessmentRoute(app, deps);
  registerCreditScoringRoute(app, deps);
  registerPipelineJobsRoute(app, deps);
};
