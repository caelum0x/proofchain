/**
 * Shared machinery for the domain-pipeline HTTP routes.
 *
 * `registerPipelineRoute` mounts one POST endpoint that validates its body with
 * a zod schema, looks the pipeline up in the registry, persists a job, runs the
 * pipeline against the adapted assessment deps, and returns the standard
 * `{ success, data, error }` envelope. `registerPipelineJobsRoute` exposes the
 * status of any pipeline job; `registerPipelineListRoute` lists the registered
 * pipelines. Keeping this generic means each `<flow>.ts` route file is a
 * one-liner that supplies its id, path and schema.
 */
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import { notFound, ok, toAppError, validationError } from '../../errors.js';
import { pipelineRegistry } from '../../pipelines/registry.js';
import { pipelineJobParamsSchema } from '../pipeline-schemas.js';
import { toAssessmentDeps, type PipelineHttpDeps } from '../pipeline-deps.js';

export interface PipelineRouteOptions {
  /** HTTP path, e.g. "/pipelines/financing-eligibility". */
  readonly path: string;
  /** Registered pipeline id, e.g. "financing_eligibility". */
  readonly pipelineId: string;
  /** Body validator; its parsed output is passed straight to the pipeline. */
  readonly schema: z.ZodTypeAny;
}

export const registerPipelineRoute = (
  app: FastifyInstance,
  deps: PipelineHttpDeps,
  opts: PipelineRouteOptions,
): void => {
  app.post(opts.path, async (request, reply) => {
    const parsed = opts.schema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError(`Invalid ${opts.pipelineId} request body`, {
        issues: parsed.error.issues,
      });
    }

    const body = parsed.data as { batchId: string };
    const pipeline = pipelineRegistry.require(opts.pipelineId);
    const job = await deps.jobStore.create(opts.pipelineId, body.batchId);

    try {
      await deps.jobStore.markRunning(job.id);
      const result = await pipeline.run(toAssessmentDeps(deps), parsed.data);
      await deps.jobStore.complete(job.id, result);
      return reply
        .code(200)
        .send(ok({ jobId: job.id, pipelineId: opts.pipelineId, result }));
    } catch (err) {
      const appErr = toAppError(err);
      await deps.jobStore.fail(job.id, {
        code: appErr.code,
        message: appErr.message,
        ...(appErr.details !== undefined ? { details: appErr.details } : {}),
      });
      request.log.error(
        {
          err: appErr.message,
          code: appErr.code,
          jobId: job.id,
          pipelineId: opts.pipelineId,
        },
        'pipeline run failed',
      );
      throw appErr;
    }
  });
};

/** GET /pipelines/jobs/:id — status of a pipeline run. */
export const registerPipelineJobsRoute = (
  app: FastifyInstance,
  deps: PipelineHttpDeps,
): void => {
  app.get('/pipelines/jobs/:id', async (request, reply) => {
    const parsed = pipelineJobParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      throw validationError('Invalid job id', { issues: parsed.error.issues });
    }
    const job = await deps.jobStore.get(parsed.data.id);
    if (job === null) {
      throw notFound(`Pipeline job ${parsed.data.id} not found`);
    }
    return reply.code(200).send(ok(job));
  });
};

/** GET /pipelines — the registered pipelines and their descriptions. */
export const registerPipelineListRoute = (app: FastifyInstance): void => {
  app.get('/pipelines', async (_request, reply) =>
    reply.code(200).send(
      ok(
        pipelineRegistry
          .all()
          .map((p) => ({ id: p.id, description: p.description })),
      ),
    ),
  );
};
