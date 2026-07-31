import { describe, expect, it } from 'vitest';
import {
  assertValidModelScore,
  computeRuleScore,
  reconcileScore,
} from '../src/domain/scoring.js';
import { createFinding } from '../src/domain/findings.js';
import { AppError } from '../src/errors.js';
import type { Finding } from '../src/shared.js';

const f = (severity: Finding['severity']): Finding =>
  createFinding(`CODE_${severity.toUpperCase()}`, severity, 'x');

describe('computeRuleScore', () => {
  it('is 10000 with no findings', () => {
    expect(computeRuleScore([])).toBe(10_000);
  });

  it('subtracts fixed penalties by severity', () => {
    expect(computeRuleScore([f('low')])).toBe(9_700);
    expect(computeRuleScore([f('medium')])).toBe(9_000);
    expect(computeRuleScore([f('high')])).toBe(7_000);
  });

  it('ignores info findings', () => {
    expect(computeRuleScore([f('info'), f('info')])).toBe(10_000);
  });

  it('accumulates multiple penalties', () => {
    expect(computeRuleScore([f('high'), f('medium'), f('low')])).toBe(5_700);
  });

  it('forces 0 on any critical finding (hard fail)', () => {
    expect(computeRuleScore([f('info'), f('critical'), f('low')])).toBe(0);
  });

  it('clamps at 0 and never goes negative', () => {
    const many = Array.from({ length: 10 }, () => f('high'));
    expect(computeRuleScore(many)).toBe(0);
  });
});

describe('assertValidModelScore', () => {
  it('accepts an in-range integer', () => {
    expect(assertValidModelScore(7_500)).toBe(7_500);
  });

  it('rejects non-integers', () => {
    expect(() => assertValidModelScore(75.5)).toThrow(AppError);
  });

  it('rejects out-of-range scores', () => {
    expect(() => assertValidModelScore(-1)).toThrow(AppError);
    expect(() => assertValidModelScore(10_001)).toThrow(AppError);
  });

  it('rejects NaN / Infinity', () => {
    expect(() => assertValidModelScore(Number.NaN)).toThrow(AppError);
    expect(() => assertValidModelScore(Number.POSITIVE_INFINITY)).toThrow(
      AppError,
    );
  });
});

describe('reconcileScore — stricter of model vs rules', () => {
  it('takes the model score when it is lower', () => {
    // rules say 9700 (one low), model says 5000 → final 5000 (model wins)
    const r = reconcileScore(5_000, [f('low')], 7_000);
    expect(r.ruleScore).toBe(9_700);
    expect(r.modelScore).toBe(5_000);
    expect(r.finalScore).toBe(5_000);
    expect(r.source).toBe('model');
    expect(r.passed).toBe(false);
  });

  it('takes the rule score when it is lower (model too generous)', () => {
    // model says 9800 but a high finding drops rules to 7000 → final 7000
    const r = reconcileScore(9_800, [f('high')], 7_000);
    expect(r.ruleScore).toBe(7_000);
    expect(r.finalScore).toBe(7_000);
    expect(r.source).toBe('rules');
    expect(r.passed).toBe(true); // exactly at threshold
  });

  it('a critical finding fails the batch regardless of a high model score', () => {
    const r = reconcileScore(10_000, [f('critical')], 7_000);
    expect(r.finalScore).toBe(0);
    expect(r.passed).toBe(false);
    expect(r.source).toBe('rules');
  });

  it('passes a clean batch when both agree', () => {
    const r = reconcileScore(9_600, [], 7_000);
    expect(r.finalScore).toBe(9_600);
    expect(r.passed).toBe(true);
  });

  it('threshold boundary: finalScore === threshold passes', () => {
    const r = reconcileScore(7_000, [], 7_000);
    expect(r.passed).toBe(true);
  });

  it('threshold boundary: one below threshold fails', () => {
    const r = reconcileScore(6_999, [], 7_000);
    expect(r.passed).toBe(false);
  });

  it('propagates model-score validation errors', () => {
    expect(() => reconcileScore(12_000, [], 7_000)).toThrow(AppError);
  });
});
