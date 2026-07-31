/**
 * Fastify server factory.
 *
 * Wires CORS, rate limiting, a uniform `{ success, data, error }` error handler,
 * and — the centerpiece — an AUTOLOADER that registers every plugin file under
 * `src/routes/` with NO central registry. To add an endpoint group you drop a
 * `src/routes/<name>.ts` that default-exports `defineRoutes(...)`; it is picked
 * up automatically. The AppContext (config/logger/chain/db) is decorated onto
 * the instance BEFORE autoloading so each router resolves its dependencies via
 * `app.appContext` (see `lib/route.ts`).
 */
import { fileURLToPath } from 'node:url';
import autoload from '@fastify/autoload';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, {
  type FastifyBaseLogger,
  type FastifyInstance,
} from 'fastify';
import { DEFAULT_BODY_LIMIT_BYTES } from './config/constants.js';
import type { AppContext } from './context.js';
import { fail } from './lib/envelope.js';
import { ApiError, toApiError, errorMessage } from './lib/errors.js';

/** Resolve the CORS `origin` option from the comma-separated allowlist. */
const resolveCorsOrigin = (raw: string): true | string[] => {
  const trimmed = raw.trim();
  if (trimmed === '*' || trimmed === '') return true; // reflect any origin
  return trimmed
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
};

export const buildServer = async (
  ctx: AppContext,
): Promise<FastifyInstance> => {
  const app = Fastify({
    // pino Logger is structurally a FastifyBaseLogger; the cast keeps the
    // instance type at the default so autoloaded plugins line up generically.
    loggerInstance: ctx.logger as unknown as FastifyBaseLogger,
    bodyLimit: DEFAULT_BODY_LIMIT_BYTES,
    trustProxy: true,
  });

  // Make dependencies available to every (auto-loaded) router.
  app.decorate('appContext', ctx);

  await app.register(cors, {
    origin: resolveCorsOrigin(ctx.config.CORS_ORIGIN),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(rateLimit, {
    max: ctx.config.RATE_LIMIT_MAX,
    timeWindow: ctx.config.RATE_LIMIT_WINDOW_MS,
  });

  // Uniform error envelope. Never leak stack traces; secrets are redacted by the
  // logger. Rate-limit rejections arrive as errors with statusCode 429.
  app.setErrorHandler((error, request, reply) => {
    if ((error as { statusCode?: number }).statusCode === 429) {
      request.log.warn({ ip: request.ip }, 'rate limit exceeded');
      return reply
        .code(429)
        .send(fail({ code: 'RATE_LIMITED', message: 'Too many requests' }));
    }

    // Fastify schema validation failures carry a `validation` array.
    if ((error as { validation?: unknown }).validation !== undefined) {
      return reply.code(400).send(
        fail({
          code: 'VALIDATION_ERROR',
          message: errorMessage(error),
          details: (error as { validation?: unknown }).validation,
        }),
      );
    }

    const apiErr: ApiError = toApiError(error);
    if (apiErr.code === 'INTERNAL_ERROR') {
      request.log.error({ err: error }, 'unhandled error');
    }
    return reply.code(apiErr.statusCode).send(
      fail({
        code: apiErr.code,
        message: apiErr.message,
        ...(apiErr.details !== undefined ? { details: apiErr.details } : {}),
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

  // AUTOLOADER: register every plugin file in src/routes/. Resolving the dir
  // from `import.meta.url` makes it work under tsx (src/) in dev and under the
  // compiled tree (dist/routes) in production. Test/type files are ignored.
  await app.register(autoload, {
    dir: fileURLToPath(new URL('./routes', import.meta.url)),
    ignorePattern: /\.(test|spec|d)\.(t|j)s$/,
    forceESM: true,
  });

  return app;
};
