/**
 * `fetch_esg` — return ESG (environmental / social / governance) metrics for the
 * batch or its supplier, so the model can flag ESG gaps or feed an ESG-weighted
 * risk view.
 *
 * A seeded ESG record (keyed by batchId or supplier) overrides the derivation; a
 * real deployment feeds measured emissions / audit ratings from an ESG oracle.
 * The derivation is deterministic: a carbon proxy from the checkpoint trail
 * (more legs / more distinct locations ⇒ more transport emissions) plus
 * hash-derived governance/social ratings for the supplier.
 */
import { z } from 'zod';
import {
  clampBps,
  createStore,
  deterministicBps,
  gradeOf,
  normalizeParty,
} from './support.js';
import { registerTool } from './registry.js';

const NAME = 'fetch_esg';

export interface EsgRecord {
  readonly carbonKg: number;
  readonly environmentBps: number;
  readonly socialBps: number;
  readonly governanceBps: number;
}

/** Seedable ESG store keyed by batchId or supplier. */
export const esgStore = createStore<EsgRecord>();

export const fetchEsgInput = z
  .object({
    scope: z.enum(['batch', 'supplier']).optional(),
  })
  .strict();

export type FetchEsgInput = z.infer<typeof fetchEsgInput>;

/** Per-checkpoint and per-distinct-location carbon proxy (kg CO2e). */
const CARBON_PER_LEG_KG = 120;
const CARBON_PER_LOCATION_KG = 300;

export const fetchEsgTool = registerTool<FetchEsgInput>({
  name: NAME,
  definition: {
    name: NAME,
    description:
      'Return ESG metrics for the batch or supplier: a carbon estimate (kg ' +
      'CO2e) and environmental/social/governance ratings (0..10000, higher = ' +
      'better) with an overall grade. Pass `scope` "batch" (default) or "supplier".',
    input_schema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['batch', 'supplier'],
          description: 'Whether to report on the batch (default) or the supplier.',
        },
      },
      additionalProperties: false,
    },
  },
  inputSchema: fetchEsgInput,
  handle: (input, ctx) => {
    const scope = input.scope ?? 'batch';
    const subject =
      scope === 'supplier' ? ctx.provenance.supplier : ctx.provenance.batchId;

    const seeded = esgStore.get(subject);
    if (seeded !== undefined) {
      const composite = clampBps(
        (seeded.environmentBps + seeded.socialBps + seeded.governanceBps) / 3,
      );
      return {
        content: {
          scope,
          subject,
          source: 'seeded',
          carbonKg: seeded.carbonKg,
          ratings: {
            environment: clampBps(seeded.environmentBps),
            social: clampBps(seeded.socialBps),
            governance: clampBps(seeded.governanceBps),
          },
          compositeBps: composite,
          grade: gradeOf(composite),
        },
      };
    }

    const checkpoints = ctx.provenance.checkpoints;
    const distinctLocations = new Set(
      checkpoints.map((c) => c.location.trim().toLowerCase()),
    ).size;
    const carbonKg =
      checkpoints.length * CARBON_PER_LEG_KG +
      distinctLocations * CARBON_PER_LOCATION_KG;

    const supplierKey = normalizeParty(ctx.provenance.supplier);
    const environment = clampBps(deterministicBps(`esg-e:${supplierKey}`));
    const social = clampBps(deterministicBps(`esg-s:${supplierKey}`));
    const governance = clampBps(deterministicBps(`esg-g:${supplierKey}`));
    const composite = clampBps((environment + social + governance) / 3);

    return {
      content: {
        scope,
        subject,
        source: 'derived',
        carbonKg,
        ratings: { environment, social, governance },
        compositeBps: composite,
        grade: gradeOf(composite),
        factors: [
          `legs(${checkpoints.length})`,
          `locations(${distinctLocations})`,
        ],
      },
    };
  },
});
