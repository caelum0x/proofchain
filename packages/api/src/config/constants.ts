/**
 * Non-secret defaults for the API. Centralized so behavior is discoverable and
 * never hardcoded inline. All are overridable via environment (see env.ts).
 */

export const CHAIN_ID_DEFAULT = 84_532; // Base Sepolia

export const DEFAULT_API_PORT = 8081;
export const DEFAULT_HOST = '0.0.0.0';

export const DEFAULT_RATE_LIMIT_MAX = 120;
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

export const DEFAULT_BODY_LIMIT_BYTES = 2 * 1024 * 1024; // 2 MB — API takes JSON only.

/** Pagination guardrails shared by list endpoints and the generic Db layer. */
export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 100;

/** Indexer defaults. */
export const DEFAULT_INDEXER_INTERVAL_MS = 15_000;
export const DEFAULT_INDEXER_BLOCK_RANGE = 2_000n;
export const DEFAULT_INDEXER_CONFIRMATIONS = 2n;
