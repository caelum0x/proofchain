/** POST /pipelines/dpp-issuance — Digital Product Passport issuance readiness. */
import type { FastifyInstance } from 'fastify';
import { registerPipelineRoute } from './pipeline-runner.js';
import { buildDppBodySchema } from '../pipeline-schemas.js';
import type { PipelineHttpDeps } from '../pipeline-deps.js';

export const registerDppIssuanceRoute = (
  app: FastifyInstance,
  deps: PipelineHttpDeps,
): void =>
  registerPipelineRoute(app, deps, {
    path: '/pipelines/dpp-issuance',
    pipelineId: 'dpp_issuance',
    schema: buildDppBodySchema(deps.config.maxDocuments),
  });
