import { describe, expect, it } from 'vitest';
import {
  assessRisk,
  registerRiskModel,
  riskLevel,
  riskRegistry,
} from '../src/risk/index.js';
import { createFinding } from '../src/domain/findings.js';
import { sampleProvenance } from './helpers.js';
import type { Finding } from '../src/shared.js';
import type { RiskContext } from '../src/risk/registry.js';

const ctx = (modelScore: number, findings: Finding[]): RiskContext => ({
  modelScore,
  findings,
  documents: [],
  provenance: sampleProvenance(),
});

const fraud = (c: RiskContext) => {
  const found = assessRisk(c).find((a) => a.model === 'fraud');
  if (found === undefined) throw new Error('fraud model not registered');
  return found;
};

describe('riskLevel banding', () => {
  it('maps scores to coarse levels', () => {
    expect(riskLevel(0)).toBe('low');
    expect(riskLevel(2_500)).toBe('medium');
    expect(riskLevel(5_000)).toBe('high');
    expect(riskLevel(7_500)).toBe('critical');
  });
});

describe('fraud risk model', () => {
  it('is registered', () => {
    expect(riskRegistry.has('fraud')).toBe(true);
  });

  it('scores a clean batch as low risk', () => {
    const r = fraud(ctx(9_500, []));
    expect(r.score).toBe(0);
    expect(r.level).toBe('low');
    expect(r.factors).toHaveLength(0);
  });

  it('pins any critical finding to maximum risk', () => {
    const r = fraud(ctx(9_500, [createFinding('X', 'critical', 'bad')]));
    expect(r.score).toBe(10_000);
    expect(r.level).toBe('critical');
  });

  it('accumulates severity contributions and records factors', () => {
    const r = fraud(ctx(9_500, [createFinding('H', 'high', 'x')]));
    expect(r.score).toBe(3_000);
    expect(r.level).toBe('medium');
    expect(r.factors).toContain('H (high)');
  });

  it('treats a very low model score as an additional signal', () => {
    const r = fraud(ctx(1_000, []));
    expect(r.score).toBe(1_500);
    expect(r.factors.some((s) => s.startsWith('low_model_score'))).toBe(true);
  });

  it('runs every registered model via assessRisk', () => {
    const all = assessRisk(ctx(9_000, []));
    expect(all.map((a) => a.model)).toContain('fraud');
  });

  it('supports Fill-agent registration of a new risk lens', () => {
    registerRiskModel({
      id: 'test_route',
      description: 'synthetic route-risk lens',
      assess: () => ({
        model: 'test_route',
        score: 6_000,
        level: riskLevel(6_000),
        factors: ['synthetic'],
      }),
    });
    const route = assessRisk(ctx(9_000, [])).find(
      (a) => a.model === 'test_route',
    );
    expect(route?.score).toBe(6_000);
    expect(route?.level).toBe('high');
  });
});
