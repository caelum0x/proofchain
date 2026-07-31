import { describe, expect, it } from 'vitest';
import { SANCTIONS_CHECKS } from '../src/checks/sanctions.js';
import { checkRegistry } from '../src/checks/index.js';
import { sampleProvenance } from './helpers.js';
import { makeDoc, runPack, codesOf, cleanInput } from './checks-support.js';
import type { Hex } from '../src/domain/types.js';

describe('sanctions cross-check pack', () => {
  it('registers its checks', () => {
    for (const c of SANCTIONS_CHECKS)
      expect(checkRegistry.has(c.code)).toBe(true);
  });

  it('is silent for benign parties and addresses', () => {
    expect(runPack(SANCTIONS_CHECKS, cleanInput())).toHaveLength(0);
  });

  it('flags a sanctioned party named as supplier (critical)', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [makeDoc('invoice', { supplierName: 'Blocked Trading Co' })],
    };
    const findings = runPack(SANCTIONS_CHECKS, input);
    expect(codesOf(findings)).toContain('SANCTIONED_PARTY');
    expect(findings.find((f) => f.code === 'SANCTIONED_PARTY')?.severity).toBe(
      'critical',
    );
  });

  it('flags a sanctioned party in a parties list', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        makeDoc('bill_of_lading', { parties: ['Acme', 'Pariah Shipping LLC'] }),
      ],
    };
    expect(codesOf(runPack(SANCTIONS_CHECKS, input))).toContain(
      'SANCTIONED_PARTY',
    );
  });

  it('flags a blocked on-chain supplier address (critical)', () => {
    const input = {
      provenance: sampleProvenance({
        supplier: '0x000000000000000000000000000000000000dEaD' as Hex,
      }),
      documents: [makeDoc('invoice', { supplierName: 'Acme' })],
    };
    const findings = runPack(SANCTIONS_CHECKS, input);
    expect(codesOf(findings)).toContain('SANCTIONED_ADDRESS');
    expect(findings.find((f) => f.code === 'SANCTIONED_ADDRESS')?.severity).toBe(
      'critical',
    );
  });
});
