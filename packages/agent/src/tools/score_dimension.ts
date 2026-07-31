/**
 * `score_dimension` — compute one (or every) registered scoring DIMENSION
 * (authenticity, consistency, compliance, completeness, model, rules, …) over
 * the current verification state and return the basis-point score(s). The model
 * can use this to see how a dimension currently reads before finalizing.
 *
 * Real logic: dispatches through the shared scorer registry, building the
 * ScoringContext from the live loop state (model score + findings recorded so
 * far) and the batch context (documents + provenance).
 */
import { z } from 'zod';
// Side-effect import: ensures the builtin `model` + `rules` scorers are registered.
import { scorerRegistry } from '../scoring/index.js';
import { clampBps } from './support.js';
import { registerTool } from './registry.js';
import type { ScoringContext } from '../scoring/registry.js';

const NAME = 'score_dimension';

export const scoreDimensionInput = z
  .object({
    dimension: z.string().min(1).max(64).optional(),
  })
  .strict();

export type ScoreDimensionInput = z.infer<typeof scoreDimensionInput>;

export const scoreDimensionTool = registerTool<ScoreDimensionInput>({
  name: NAME,
  definition: {
    name: NAME,
    description:
      'Score one verification dimension (or all of them) in basis points ' +
      '(0..10000, higher = cleaner) from the findings recorded so far. Pass ' +
      '`dimension` (e.g. "rules", "model") or omit it to score every ' +
      'registered dimension.',
    input_schema: {
      type: 'object',
      properties: {
        dimension: {
          type: 'string',
          description: 'A single dimension id to score.',
        },
      },
      additionalProperties: false,
    },
  },
  inputSchema: scoreDimensionInput,
  handle: (input, ctx, state) => {
    const scoringCtx: ScoringContext = {
      modelScore: state.modelScore,
      findings: state.findings,
      documents: ctx.documents,
      provenance: ctx.provenance,
    };

    if (input.dimension !== undefined) {
      const scorer = scorerRegistry.get(input.dimension);
      if (scorer === undefined) {
        return {
          content: {
            error: `Unknown dimension "${input.dimension}"`,
            availableDimensions: scorerRegistry.keys(),
          },
          isError: true,
        };
      }
      const dim = scorer.score(scoringCtx);
      return { content: { ...dim, score: clampBps(dim.score) } };
    }

    const dimensions = scorerRegistry.all().map((s) => {
      const dim = s.score(scoringCtx);
      return { ...dim, score: clampBps(dim.score) };
    });
    const lowest = dimensions.reduce<(typeof dimensions)[number] | undefined>(
      (min, d) => (min === undefined || d.score < min.score ? d : min),
      undefined,
    );
    return {
      content: {
        dimensions,
        lowest: lowest?.dimension ?? null,
        lowestScore: lowest?.score ?? null,
      },
    };
  },
});
