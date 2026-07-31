/** POST /pipelines/quality-grading — batch quality grade (A–F). */
import type { FastifyInstance } from 'fastify';
import { registerPipelineRoute } from './pipeline-runner.js';
import { buildQualityBodySchema } from '../pipeline-schemas.js';
import type { PipelineHttpDeps } from '../pipeline-deps.js';

export const registerQualityGradingRoute = (
  app: FastifyInstance,
  deps: PipelineHttpDeps,
): void =>
  registerPipelineRoute(app, deps, {
    path: '/pipelines/quality-grading',
    pipelineId: 'quality_grading',
    schema: buildQualityBodySchema(deps.config.maxDocuments),
  });
