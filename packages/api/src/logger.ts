/**
 * Structured logging (pino). Redacts sensitive fields so secrets never reach the
 * logs. A single shared instance is created from config at startup and injected
 * everywhere via the AppContext (no module-level singletons).
 */
import { pino, type Logger } from 'pino';
import type { ApiConfig } from './config/env.js';

export type { Logger };

export const createLogger = (config: ApiConfig): Logger =>
  pino({
    level: config.LOG_LEVEL,
    base: { service: '@proofchain/api' },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]',
        'SUPABASE_SERVICE_ROLE_KEY',
        'serviceRoleKey',
        'apiKey',
      ],
      censor: '[redacted]',
    },
    transport:
      config.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  });
