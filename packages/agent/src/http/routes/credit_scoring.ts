/** POST /pipelines/credit-scoring — counterparty credit score. */
import type { FastifyInstance } from 'fastify';
import { registerPipelineRoute } from './pipeline-runner.js';
import { buildCreditBodySchema } from '../pipeline-schemas.js';
import type { PipelineHttpDeps } from '../pipeline-deps.js';

export const registerCreditScoringRoute = (
  app: FastifyInstance,
  deps: PipelineHttpDeps,
): void =>
  registerPipelineRoute(app, deps, {
    path: '/pipelines/credit-scoring',
    pipelineId: 'credit_scoring',
    schema: buildCreditBodySchema(deps.config.maxDocuments),
  });
