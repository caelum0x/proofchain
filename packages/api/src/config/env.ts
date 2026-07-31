/**
 * Environment loading + validation. Fails fast at startup if a required value
 * is missing or malformed. No secret is ever hardcoded; every value is
 * documented in `.env.example`.
 *
 * Supabase vars are OPTIONAL by design (mirrors @proofchain/infra): the DB layer
 * degrades to a no-op store when they are absent, so the read API still boots
 * and serves chain-derived health. `BASE_SEPOLIA_RPC_URL` and `API_PORT` are the
 * only hard requirements.
 */
import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import {
  CHAIN_ID_DEFAULT,
  DEFAULT_API_PORT,
  DEFAULT_HOST,
  DEFAULT_INDEXER_BLOCK_RANGE,
  DEFAULT_INDEXER_CONFIRMATIONS,
  DEFAULT_INDEXER_INTERVAL_MS,
  DEFAULT_RATE_LIMIT_MAX,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
} from './constants.js';

const booleanish = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.enum(['true', 'false', '1', '0']))
  .transform((v) => v === 'true' || v === '1');

const bigintish = z
  .string()
  .trim()
  .regex(/^\d+$/, 'must be a non-negative integer')
  .transform((v) => BigInt(v));

const rawEnvSchema = z.object({
  // --- HTTP ---
  API_PORT: z.coerce.number().int().positive().default(DEFAULT_API_PORT),
  HOST: z.string().min(1).default(DEFAULT_HOST),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  // Comma-separated allowlist for CORS, or `*` (default) to reflect any origin.
  CORS_ORIGIN: z.string().min(1).default('*'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(DEFAULT_RATE_LIMIT_MAX),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_RATE_LIMIT_WINDOW_MS),

  // --- Chain (required) ---
  BASE_SEPOLIA_RPC_URL: z.string().url('BASE_SEPOLIA_RPC_URL must be a URL'),
  CHAIN_ID: z.coerce.number().int().positive().default(CHAIN_ID_DEFAULT),

  // --- Supabase (optional — DB layer no-ops when unset) ---
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a URL').optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // --- Indexer ---
  INDEXER_ENABLED: booleanish.default('false'),
  INDEXER_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_INDEXER_INTERVAL_MS),
  INDEXER_BLOCK_RANGE: bigintish.default(String(DEFAULT_INDEXER_BLOCK_RANGE)),
  INDEXER_CONFIRMATIONS: bigintish.default(String(DEFAULT_INDEXER_CONFIRMATIONS)),
  // Block to start indexing from on a cold cursor. Default 0 (genesis of watched
  // contracts); set to the deploy block in production to avoid a slow backfill.
  INDEXER_START_BLOCK: bigintish.default('0'),
});

export type ApiConfig = Readonly<z.infer<typeof rawEnvSchema>>;

/** Whether Supabase persistence is configured (both URL + key present). */
export const isSupabaseConfigured = (config: ApiConfig): boolean =>
  config.SUPABASE_URL !== undefined && config.SUPABASE_SERVICE_ROLE_KEY !== undefined;

/**
 * Parse + validate a raw environment map (defaults to `process.env`). Throws a
 * CONFIG_ERROR `ApiError` listing every problem — never a raw `ZodError`, and
 * never a value that leaks a secret.
 */
export const loadConfig = (source: NodeJS.ProcessEnv = process.env): ApiConfig => {
  // Treat empty strings as absent so `SUPABASE_URL=` in a shared .env doesn't
  // fail URL validation — it simply means "not configured".
  const normalized: Record<string, string | undefined> = { ...source };
  for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CORS_ORIGIN']) {
    const value = normalized[key];
    if (typeof value === 'string' && value.trim().length === 0) {
      normalized[key] = undefined;
    }
  }

  const parsed = rawEnvSchema.safeParse(normalized);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
    );
    throw new ApiError(
      'CONFIG_ERROR',
      `Invalid environment configuration:\n  - ${issues.join('\n  - ')}`,
      { issues },
    );
  }
  return Object.freeze(parsed.data);
};
