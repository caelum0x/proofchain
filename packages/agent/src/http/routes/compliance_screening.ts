/** POST /pipelines/compliance-screening — sanctions/AML/trade screening. */
import type { FastifyInstance } from 'fastify';
import { registerPipelineRoute } from './pipeline-runner.js';
import { buildComplianceBodySchema } from '../pipeline-schemas.js';
import type { PipelineHttpDeps } from '../pipeline-deps.js';

export const registerComplianceScreeningRoute = (
  app: FastifyInstance,
  deps: PipelineHttpDeps,
): void =>
  registerPipelineRoute(app, deps, {
    path: '/pipelines/compliance-screening',
    pipelineId: 'compliance_screening',
    schema: buildComplianceBodySchema(deps.config.maxDocuments),
  });
