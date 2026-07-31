/**
 * Logistics route risk lens.
 *
 * Derived purely from the on-chain checkpoint trail (the verifiable movement
 * record). Risk rises when there is no route visibility at all, when a single
 * checkpoint offers no proof of movement, when checkpoint timestamps are
 * non-monotonic (a tampered or replayed trail), and when the dwell gap between
 * consecutive checkpoints is implausibly long (goods stalled / diverted).
 */
import { registerRiskModel, riskLevel } from './registry.js';
import type { RiskContext } from './registry.js';
import type { Checkpoint } from '../domain/types.js';
import { clampRiskBps } from './util.js';

const NO_CHECKPOINTS_BPS = 4_000;
const SINGLE_CHECKPOINT_BPS = 1_500;
const OUT_OF_ORDER_BPS = 3_000;
const LONG_GAP_BPS = 1_200;

/** Maximum plausible dwell time between two checkpoints (30 days, seconds). */
const MAX_GAP_SECONDS = 30 * 24 * 60 * 60;

interface TrailAnalysis {
  readonly outOfOrder: boolean;
  readonly longGaps: number;
}

const analyzeTrail = (checkpoints: readonly Checkpoint[]): TrailAnalysis => {
  let outOfOrder = false;
  let longGaps = 0;
  for (let i = 1; i < checkpoints.length; i += 1) {
    const prev = checkpoints[i - 1];
    const cur = checkpoints[i];
    if (prev === undefined || cur === undefined) continue;
    const delta = cur.timestamp - prev.timestamp;
    if (delta < 0) outOfOrder = true;
    else if (delta > MAX_GAP_SECONDS) longGaps += 1;
  }
  return { outOfOrder, longGaps };
};

export const routeRiskModel = registerRiskModel({
  id: 'route',
  description:
    'Logistics route risk from checkpoint coverage, chronological order and dwell gaps.',
  assess: (ctx: RiskContext) => {
    const factors: string[] = [];
    let score = 0;
    const checkpoints = ctx.provenance.checkpoints;

    if (checkpoints.length === 0) {
      score += NO_CHECKPOINTS_BPS;
      factors.push('no_route_visibility');
    } else if (checkpoints.length === 1) {
      score += SINGLE_CHECKPOINT_BPS;
      factors.push('single_checkpoint_no_movement');
    }

    const { outOfOrder, longGaps } = analyzeTrail(checkpoints);
    if (outOfOrder) {
      score += OUT_OF_ORDER_BPS;
      factors.push('non_monotonic_checkpoints');
    }
    if (longGaps > 0) {
      score += LONG_GAP_BPS * longGaps;
      factors.push(`long_dwell_gaps(${longGaps})`);
    }

    const bounded = clampRiskBps(score);
    return {
      model: 'route',
      score: bounded,
      level: riskLevel(bounded),
      factors,
    };
  },
});
