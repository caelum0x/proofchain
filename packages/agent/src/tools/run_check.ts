/**
 * `run_check` — execute one (or a whole domain of) registered deterministic
 * cross-check rule(s) against the batch under verification and return the
 * findings, WITHOUT recording them. This lets the model ground its reasoning in
 * the same verifiable rule engine the pipeline runs independently: it can probe
 * a specific rule, see the result, and then decide whether to `record_finding`.
 *
 * Real logic: dispatches straight through the shared cross-check registry (the
 * builtin trade/provenance rules plus any domain packs Fill agents register).
 */
import { z } from 'zod';
// Side-effect import: ensures the builtin cross-checks are registered.
import { checkRegistry } from '../checks/index.js';
import { registerTool } from './registry.js';
import type { CrossCheckInput } from '../domain/types.js';

const NAME = 'run_check';

export const runCheckInput = z
  .object({
    code: z.string().min(1).max(128).optional(),
    domain: z.string().min(1).max(64).optional(),
  })
  .strict();

export type RunCheckInput = z.infer<typeof runCheckInput>;

export const runCheckTool = registerTool<RunCheckInput>({
  name: NAME,
  definition: {
    name: NAME,
    description:
      'Run deterministic cross-check rule(s) against this batch and return the ' +
      'findings (does NOT record them). Pass `code` for one specific rule, ' +
      '`domain` to run every rule in a domain (trade, provenance, quantity, ' +
      'temporal, structural, …), or neither to run all registered rules.',
    input_schema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'A single cross-check rule id, e.g. "core.invoice_totals".',
        },
        domain: {
          type: 'string',
          description: 'Run every rule tagged with this domain.',
        },
      },
      additionalProperties: false,
    },
  },
  inputSchema: runCheckInput,
  handle: (input, ctx) => {
    const crossCheckInput: CrossCheckInput = {
      provenance: ctx.provenance,
      documents: [...ctx.documents],
    };

    if (input.code !== undefined) {
      const check = checkRegistry.get(input.code);
      if (check === undefined) {
        return {
          content: {
            error: `Unknown check "${input.code}"`,
            availableCodes: checkRegistry.keys(),
          },
          isError: true,
        };
      }
      const findings = check.run(crossCheckInput);
      return { content: { ran: [check.code], findingCount: findings.length, findings } };
    }

    const checks =
      input.domain !== undefined
        ? checkRegistry.all().filter((c) => c.domain === input.domain)
        : checkRegistry.all();

    if (input.domain !== undefined && checks.length === 0) {
      return {
        content: {
          error: `No checks registered for domain "${input.domain}"`,
          availableDomains: [...new Set(checkRegistry.all().map((c) => c.domain))],
        },
        isError: true,
      };
    }

    const ran = checks.map((c) => c.code);
    const findings = checks.flatMap((c) => c.run(crossCheckInput));
    return { content: { ran, findingCount: findings.length, findings } };
  },
});
