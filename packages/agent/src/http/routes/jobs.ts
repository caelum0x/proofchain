/**
 * GET /jobs/:id — report the status (and result/error) of a verification job.
 */
import type { FastifyInstance } from 'fastify';
import { notFound, ok, validationError } from '../../errors.js';
import { jobParamsSchema } from '../schemas.js';
import type { AppDeps } from '../types.js';

export const registerJobsRoute = (
  app: FastifyInstance,
  deps: AppDeps,
): void => {
  app.get('/jobs/:id', async (request, reply) => {
    const parsed = jobParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      throw validationError('Invalid job id', { issues: parsed.error.issues });
    }

    const job = await deps.jobStore.get(parsed.data.id);
    if (job === null) {
      throw notFound(`Job ${parsed.data.id} not found`);
    }

    return reply.code(200).send(ok(job));
  });
};
