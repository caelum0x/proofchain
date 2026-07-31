/**
 * Structured logging (pino). Redacts sensitive fields so secrets never reach
 * the logs. A single shared instance is created from config at startup.
 */
import { pino, type Logger } from 'pino';
import type { AppConfig } from './config/env.js';

export type { Logger };

export const createLogger = (config: AppConfig): Logger =>
  pino({
    level: config.LOG_LEVEL,
    base: { service: '@proofchain/agent' },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers["x-api-key"]',
        'apiKey',
        'privateKey',
        'AGENT_PRIVATE_KEY',
        'ANTHROPIC_API_KEY',
      ],
      censor: '[redacted]',
    },
    transport:
      config.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  });
