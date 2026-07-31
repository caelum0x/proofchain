/**
 * POST /verify — run the full verification pipeline for a batch and return the
 * verdict + tx hash. The job is persisted so its status is queryable.
 */
import type { FastifyInstance } from 'fastify';
import { ok, toAppError } from '../../errors.js';
import { buildVerifyBodySchema } from '../schemas.js';
import { validationError } from '../../errors.js';
import type { AppDeps } from '../types.js';
import type { Hex, InputDocument } from '../../domain/types.js';

export const registerVerifyRoute = (
  app: FastifyInstance,
  deps: AppDeps,
): void => {
  const verifyBodySchema = buildVerifyBodySchema(deps.config.MAX_DOCUMENTS);
  app.post('/verify', async (request, reply) => {
    const parsed = verifyBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Invalid verify request body', {
        issues: parsed.error.issues,
      });
    }

    const batchId = parsed.data.batchId as Hex;
    const documents = parsed.data.documents as InputDocument[];
    const job = await deps.jobStore.create(batchId);

    try {
      await deps.jobStore.markRunning(job.id);
      const result = await deps.verifier.verify({ batchId, documents });
      await deps.jobStore.complete(job.id, result);
      return reply.code(200).send(ok({ jobId: job.id, ...result }));
    } catch (err) {
      const appErr = toAppError(err);
      await deps.jobStore.fail(job.id, {
        code: appErr.code,
        message: appErr.message,
        ...(appErr.details !== undefined ? { details: appErr.details } : {}),
      });
      request.log.error(
        { err: appErr.message, code: appErr.code, jobId: job.id, batchId },
        'verify failed',
      );
      throw appErr;
    }
  });
};
