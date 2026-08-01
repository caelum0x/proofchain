/**
 * Environment loading + validation. Fails fast at startup if any required
 * secret is missing or malformed. No secret is ever hardcoded; every value is
 * documented in .env.example.
 */
import { z } from 'zod';
import { AppError } from '../errors.js';
import {
  DEFAULT_HOST,
  DEFAULT_MAX_DOCUMENTS,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MAX_TOOL_ITERATIONS,
  DEFAULT_MODEL,
  DEFAULT_PARSE_MODEL,
  DEFAULT_PASS_THRESHOLD_BPS,
  DEFAULT_PORT,
  DEFAULT_RATE_LIMIT_MAX,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
  DEFAULT_VERIFY_TIMEOUT_MS,
  MAX_SCORE_BPS,
} from './constants.js';

const hexPrivateKey = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, 'must be a 0x-prefixed 32-byte hex string');

const booleanish = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.enum(['true', 'false', '1', '0']))
  .transform((v) => v === 'true' || v === '1');

const rawEnvSchema = z.object({
  // --- Required secrets / connectivity ---
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  AGENT_PRIVATE_KEY: hexPrivateKey,
  // JSON-RPC endpoint for the target chain (Ethereum Sepolia by default).
  BASE_SEPOLIA_RPC_URL: z.string().url('BASE_SEPOLIA_RPC_URL must be a URL'),

  // --- Optional behavior ---
  SETTLE_ON_ATTEST: booleanish.default('false'),
  CHAIN_ID: z.coerce.number().int().positive().default(11_155_111),
  PASS_THRESHOLD_BPS: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_SCORE_BPS)
    .default(DEFAULT_PASS_THRESHOLD_BPS),

  // --- Storage (optional) ---
  PINATA_JWT: z.string().min(1).optional(),

  // --- Model config ---
  ANTHROPIC_MODEL: z.string().min(1).default(DEFAULT_MODEL),
  ANTHROPIC_PARSE_MODEL: z.string().min(1).default(DEFAULT_PARSE_MODEL),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().int().positive().default(DEFAULT_MAX_TOKENS),

  // --- Orchestrator rails ---
  MAX_TOOL_ITERATIONS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_MAX_TOOL_ITERATIONS),
  VERIFY_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_VERIFY_TIMEOUT_MS),
  MAX_DOCUMENTS: z.coerce.number().int().positive().default(DEFAULT_MAX_DOCUMENTS),

  // --- HTTP ---
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  HOST: z.string().min(1).default(DEFAULT_HOST),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(DEFAULT_RATE_LIMIT_MAX),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_RATE_LIMIT_WINDOW_MS),
});

export type AppConfig = Readonly<z.infer<typeof rawEnvSchema>>;

/**
 * Parse + validate a raw environment map (defaults to process.env). Throws a
 * CONFIG_ERROR AppError listing every problem — never a raw ZodError.
 */
export const loadConfig = (
  source: NodeJS.ProcessEnv = process.env,
): AppConfig => {
  const parsed = rawEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
    );
    throw new AppError(
      'CONFIG_ERROR',
      `Invalid environment configuration:\n  - ${issues.join('\n  - ')}`,
      { issues },
    );
  }
  return Object.freeze(parsed.data);
};
