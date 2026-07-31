/** POST /pipelines/insurance-underwriting — cargo/parametric/credit underwriting. */
import type { FastifyInstance } from 'fastify';
import { registerPipelineRoute } from './pipeline-runner.js';
import { buildInsuranceBodySchema } from '../pipeline-schemas.js';
import type { PipelineHttpDeps } from '../pipeline-deps.js';

export const registerInsuranceUnderwritingRoute = (
  app: FastifyInstance,
  deps: PipelineHttpDeps,
): void =>
  registerPipelineRoute(app, deps, {
    path: '/pipelines/insurance-underwriting',
    pipelineId: 'insurance_underwriting',
    schema: buildInsuranceBodySchema(deps.config.maxDocuments),
  });
