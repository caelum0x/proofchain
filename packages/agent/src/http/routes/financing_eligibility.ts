/** POST /pipelines/financing-eligibility — trade-finance eligibility flow. */
import type { FastifyInstance } from 'fastify';
import { registerPipelineRoute } from './pipeline-runner.js';
import { buildFinancingBodySchema } from '../pipeline-schemas.js';
import type { PipelineHttpDeps } from '../pipeline-deps.js';

export const registerFinancingEligibilityRoute = (
  app: FastifyInstance,
  deps: PipelineHttpDeps,
): void =>
  registerPipelineRoute(app, deps, {
    path: '/pipelines/financing-eligibility',
    pipelineId: 'financing_eligibility',
    schema: buildFinancingBodySchema(deps.config.maxDocuments),
  });
