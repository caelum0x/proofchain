/** POST /pipelines/esg-assessment — E/S/G sub-scores and overall rating. */
import type { FastifyInstance } from 'fastify';
import { registerPipelineRoute } from './pipeline-runner.js';
import { buildEsgBodySchema } from '../pipeline-schemas.js';
import type { PipelineHttpDeps } from '../pipeline-deps.js';

export const registerEsgAssessmentRoute = (
  app: FastifyInstance,
  deps: PipelineHttpDeps,
): void =>
  registerPipelineRoute(app, deps, {
    path: '/pipelines/esg-assessment',
    pipelineId: 'esg_assessment',
    schema: buildEsgBodySchema(deps.config.maxDocuments),
  });
