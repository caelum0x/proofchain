import { describe, expect, it } from 'vitest';
import { reconcile, registerScorer } from '../src/scoring/index.js';
import { reconcileScore } from '../src/domain/scoring.js';
import { createFinding } from '../src/domain/findings.js';
import { AppError } from '../src/errors.js';
import { sampleProvenance } from './helpers.js';
import type { Finding } from '../src/shared.js';
import type { ScoringContext } from '../src/scoring/registry.js';

const ctx = (modelScore: number, findings: Finding[]): ScoringContext => ({
  modelScore,
  findings,
  documents: [],
  provenance: sampleProvenance(),
});

const f = (severity: Finding['severity']): Finding =>
  createFinding(`CODE_${severity.toUpperCase()}`, severity, 'x');

describe('scoring registry reconcile (builtin model + rules)', () => {
  it('exposes both builtin dimensions', () => {
    const r = reconcile(ctx(9_600, []), 7_000);
    expect(r.dimensions.map((d) => d.dimension).sort()).toEqual([
      'model',
      'rules',
    ]);
  });

  it('reproduces legacy reconcileScore across cases', () => {
    const cases: Array<[number, Finding[], number]> = [
      [5_000, [f('low')], 7_000],
      [9_800, [f('high')], 7_000],
      [10_000, [f('critical')], 7_000],
      [9_600, [], 7_000],
      [7_000, [], 7_000],
      [6_999, [], 7_000],
    ];
    for (const [model, findings, threshold] of cases) {
      const legacy = reconcileScore(model, findings, threshold);
      const reg = reconcile(ctx(model, findings), threshold);
      expect(reg.finalScore).toBe(legacy.finalScore);
      expect(reg.passed).toBe(legacy.passed);
      expect(reg.source).toBe(legacy.source);
      expect(reg.modelScore).toBe(legacy.modelScore);
      expect(reg.ruleScore).toBe(legacy.ruleScore);
    }
  });

  it('propagates model-score validation errors', () => {
    expect(() => reconcile(ctx(12_000, []), 7_000)).toThrowError(AppError);
  });

  it('a newly registered stricter dimension wins under strict-min', () => {
    registerScorer({
      dimension: 'authenticity',
      description: 'synthetic strict dimension',
      weight: 1,
      score: () => ({ dimension: 'authenticity', score: 4_200 }),
    });
    // model 9600, rules 10000, authenticity 4200 → min is authenticity.
    const r = reconcile(ctx(9_600, []), 7_000);
    expect(r.finalScore).toBe(4_200);
    expect(r.source).toBe('authenticity');
    expect(r.passed).toBe(false);
  });
});
