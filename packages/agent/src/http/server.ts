/**
 * Fastify server factory. Wires rate limiting, a structured error handler
 * (every error becomes the `{ success, data, error }` envelope), and the three
 * routes. Pure composition — all behaviour is injected via AppDeps.
 */
import rateLimit from '@fastify/rate-limit';
import Fastify, {
  type FastifyBaseLogger,
  type FastifyInstance,
} from 'fastify';
import { AppError, fail, toAppError } from '../errors.js';
import { registerHealthRoute } from './routes/health.js';
import { registerJobsRoute } from './routes/jobs.js';
import { registerVerifyRoute } from './routes/verify.js';
import type { AppDeps } from './types.js';

export const buildServer = async (
  deps: AppDeps,
): Promise<FastifyInstance> => {
  const app = Fastify({
    // pino Logger is structurally a FastifyBaseLogger; cast keeps the instance
    // type at the default so route registration generics line up.
    loggerInstance: deps.logger as unknown as FastifyBaseLogger,
    bodyLimit: 25 * 1024 * 1024, // 25 MB — documents can be large.
  });

  await app.register(rateLimit, {
    max: deps.config.RATE_LIMIT_MAX,
    timeWindow: deps.config.RATE_LIMIT_WINDOW_MS,
  });

  // Uniform error envelope. Never leak stack traces; secrets are redacted by
  // the logger. Rate-limit rejections arrive as errors with statusCode 429.
  app.setErrorHandler((error, request, reply) => {
    if ((error as { statusCode?: number }).statusCode === 429) {
      request.log.warn({ ip: request.ip }, 'rate limit exceeded');
      return reply.code(429).send(
        fail({ code: 'RATE_LIMITED', message: 'Too many requests' }),
      );
    }

    const appErr: AppError = toAppError(error);
    if (appErr.code === 'INTERNAL_ERROR') {
      request.log.error({ err: error }, 'unhandled error');
    }
    return reply.code(appErr.statusCode).send(
      fail({
        code: appErr.code,
        message: appErr.message,
        ...(appErr.details !== undefined ? { details: appErr.details } : {}),
      }),
    );
  });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send(
      fail({
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      }),
    ),
  );

  registerHealthRoute(app, deps);
  registerVerifyRoute(app, deps);
  registerJobsRoute(app, deps);

  return app;
};
