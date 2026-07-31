/**
 * Non-secret tuning constants. No hardcoded secrets live here — only algorithm
 * parameters and safe defaults. Env overrides are wired in config/env.ts.
 */
import type { FindingSeverity } from '../shared.js';

/** Score domain is basis points: 0..10000 (10000 = 1.00). */
export const MAX_SCORE_BPS = 10_000;
export const MIN_SCORE_BPS = 0;

/** Default pass threshold in bps (mirrors SettlementEscrow default of 7000). */
export const DEFAULT_PASS_THRESHOLD_BPS = 7_000;

/**
 * Deterministic rule-based penalty (in bps) applied per finding, keyed by
 * severity. The rule score starts at MAX_SCORE_BPS and subtracts these.
 * `critical` forces a full failure regardless of anything else.
 */
export const SEVERITY_PENALTY_BPS: Record<FindingSeverity, number> = {
  info: 0,
  low: 300,
  medium: 1_000,
  high: 3_000,
  critical: MAX_SCORE_BPS,
};

/** Rank used for de-duplication (keep the strictest instance of a code). */
export const SEVERITY_RANK: Record<FindingSeverity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/** Orchestrator safety rails (defaults; overridable via env). */
export const DEFAULT_MAX_TOOL_ITERATIONS = 12;
export const DEFAULT_VERIFY_TIMEOUT_MS = 120_000;
export const DEFAULT_MAX_DOCUMENTS = 16;

/**
 * Hard timeout for fetching a document by URL. The orchestrator VERIFY_TIMEOUT
 * only guards the Claude loop, so a hung upstream fetch during parsing must be
 * bounded independently or it can stall the whole pipeline indefinitely.
 */
export const DOCUMENT_FETCH_TIMEOUT_MS = 30_000;

/** Claude models (per SPEC). */
export const DEFAULT_MODEL = 'claude-opus-4-8';
export const DEFAULT_PARSE_MODEL = 'claude-haiku-4-5';
export const DEFAULT_MAX_TOKENS = 4_096;

/** HTTP defaults. */
export const DEFAULT_PORT = 8_080;
export const DEFAULT_HOST = '0.0.0.0';
export const DEFAULT_RATE_LIMIT_MAX = 60;
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
