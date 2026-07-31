import { describe, expect, it } from 'vitest';
import { WEIGHT_CHECKS } from '../src/checks/weight.js';
import { checkRegistry } from '../src/checks/index.js';
import { sampleProvenance } from './helpers.js';
import { makeDoc, runPack, codesOf, cleanInput } from './checks-support.js';

describe('weight cross-check pack', () => {
  it('registers its checks', () => {
    for (const c of WEIGHT_CHECKS) expect(checkRegistry.has(c.code)).toBe(true);
  });

  it('is silent when no weight certificate is present', () => {
    expect(runPack(WEIGHT_CHECKS, cleanInput())).toHaveLength(0);
  });

  it('flags a non-positive certified weight', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [makeDoc('weight_certificate', { quantity: 0 })],
    };
    expect(codesOf(runPack(WEIGHT_CHECKS, input))).toContain('WEIGHT_NONPOSITIVE');
  });

  it('flags a certificate with no weight value', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [makeDoc('weight_certificate', { supplierName: 'Acme' })],
    };
    expect(codesOf(runPack(WEIGHT_CHECKS, input))).toContain(
      'WEIGHT_MISSING_VALUE',
    );
  });

  it('flags a weight mismatch against the packing list', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        makeDoc('weight_certificate', { quantity: 1_000 }),
        makeDoc('packing_list', { quantity: 800 }),
      ],
    };
    expect(codesOf(runPack(WEIGHT_CHECKS, input))).toContain('WEIGHT_MISMATCH');
  });

  it('accepts matching certificate and packing list', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        makeDoc('weight_certificate', { quantity: 1_000 }),
        makeDoc('packing_list', { quantity: 1_000 }),
      ],
    };
    expect(runPack(WEIGHT_CHECKS, input)).toHaveLength(0);
  });
});
