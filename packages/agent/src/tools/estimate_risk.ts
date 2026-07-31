/**
 * `estimate_risk` — run one (or every) registered risk model (fraud, credit,
 * counterparty, route, esg, …) over the current verification state and return
 * the advisory risk assessment(s). Risk is advisory: it never gates the base
 * attestation, but the model can surface it in its summary or use it to weight
 * how aggressively to inspect.
 *
 * Real logic: dispatches through the shared risk-model registry, building the
 * RiskContext from the live loop state and the batch context.
 */
import { z } from 'zod';
// Side-effect import: ensures the builtin fraud model is registered.
import { riskRegistry } from '../risk/index.js';
import { registerTool } from './registry.js';
import type { RiskContext } from '../risk/registry.js';

const NAME = 'estimate_risk';

export const estimateRiskInput = z
  .object({
    model: z.string().min(1).max(64).optional(),
  })
  .strict();

export type EstimateRiskInput = z.infer<typeof estimateRiskInput>;

export const estimateRiskTool = registerTool<EstimateRiskInput>({
  name: NAME,
  definition: {
    name: NAME,
    description:
      'Estimate advisory risk in basis points (0..10000, higher = MORE risk) ' +
      'with a coarse level and contributing factors. Pass `model` for one lens ' +
      '(e.g. "fraud") or omit it to run every registered risk model.',
    input_schema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'A single risk model id to run.',
        },
      },
      additionalProperties: false,
    },
  },
  inputSchema: estimateRiskInput,
  handle: (input, ctx, state) => {
    const riskCtx: RiskContext = {
      modelScore: state.modelScore,
      findings: state.findings,
      documents: ctx.documents,
      provenance: ctx.provenance,
    };

    if (input.model !== undefined) {
      const model = riskRegistry.get(input.model);
      if (model === undefined) {
        return {
          content: {
            error: `Unknown risk model "${input.model}"`,
            availableModels: riskRegistry.keys(),
          },
          isError: true,
        };
      }
      return { content: model.assess(riskCtx) };
    }

    const assessments = riskRegistry.all().map((m) => m.assess(riskCtx));
    const highest = assessments.reduce<(typeof assessments)[number] | undefined>(
      (max, a) => (max === undefined || a.score > max.score ? a : max),
      undefined,
    );
    return {
      content: {
        assessments,
        highest: highest?.model,
        highestScore: highest?.score,
      },
    };
  },
});
