/**
 * Cross-check registry.
 *
 * A `CrossCheck` is a pure, deterministic rule over (provenance, parsed
 * documents) that returns zero or more findings. Checks run INDEPENDENTLY of
 * the model so the verdict is grounded in verifiable facts. The verification
 * pipeline sources ALL checks from this registry — builtin trade rules plus any
 * domain rule packs Fill agents add.
 *
 * REGISTRATION CONVENTION
 *   Create `src/checks/<domain>.ts` exporting one or more `CrossCheck` objects
 *   and calling `registerCheck(...)` at module top level, then append a
 *   side-effect import to `src/checks/index.ts`. Each check's `code` is its
 *   unique registry key (NOT the finding code it may emit). Never edit this file.
 */
import { createRegistry } from '../registry/registry.js';
import type { CrossCheckInput } from '../domain/types.js';
import type { Finding } from '../shared.js';

export interface CrossCheck {
  /** Unique rule id AND registry key, e.g. "core.invoice_totals". */
  readonly code: string;
  /** Domain grouping: trade, customs, quality, cold-chain, sanctions, … */
  readonly domain: string;
  /** One-line description of what the rule asserts. */
  readonly description: string;
  /** Pure evaluation: same input → same findings, no side effects. */
  run(ctx: CrossCheckInput): Finding[];
}

export const checkRegistry = createRegistry<CrossCheck>({
  label: 'cross-check',
  keyOf: (c) => c.code,
});

/** Register a cross-check (called by each `src/checks/<domain>.ts` module). */
export const registerCheck = (check: CrossCheck): CrossCheck =>
  checkRegistry.register(check);

/** Register many checks at once. */
export const registerChecks = (checks: readonly CrossCheck[]): void =>
  checkRegistry.registerAll(checks);

/**
 * Run every registered cross-check and collect all findings in registration
 * order (order-stable). Deduplication/merging is the caller's concern.
 */
export const runRegisteredChecks = (ctx: CrossCheckInput): Finding[] =>
  checkRegistry.all().flatMap((check) => check.run(ctx));

/** Run only the checks belonging to a given domain (for targeted pipelines). */
export const runChecksForDomain = (
  ctx: CrossCheckInput,
  domain: string,
): Finding[] =>
  checkRegistry
    .all()
    .filter((c) => c.domain === domain)
    .flatMap((c) => c.run(ctx));
