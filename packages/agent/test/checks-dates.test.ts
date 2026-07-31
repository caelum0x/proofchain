import { describe, expect, it } from 'vitest';
import { DATES_CHECKS } from '../src/checks/dates.js';
import { checkRegistry } from '../src/checks/index.js';
import { sampleProvenance, invoiceDoc } from './helpers.js';
import { makeDoc, runPack, codesOf, cleanInput } from './checks-support.js';
import type { Hex } from '../src/domain/types.js';

const DATA_HASH = `0x${'d'.repeat(64)}` as Hex;

describe('dates cross-check pack', () => {
  it('registers its checks', () => {
    for (const c of DATES_CHECKS) expect(checkRegistry.has(c.code)).toBe(true);
  });

  it('is silent on a clean input with no dates', () => {
    expect(runPack(DATES_CHECKS, cleanInput())).toHaveLength(0);
  });

  it('flags an unparseable date', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [invoiceDoc({ fields: { date: 'not-a-date' } })],
    };
    expect(codesOf(runPack(DATES_CHECKS, input))).toContain(
      'DATES_INVALID_FORMAT',
    );
  });

  it('flags an implausible spread between document dates', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { date: '2010-01-01T00:00:00.000Z' } }),
        makeDoc('bill_of_lading', { date: '2024-01-01T00:00:00.000Z' }),
      ],
    };
    expect(codesOf(runPack(DATES_CHECKS, input))).toContain(
      'DATES_IMPLAUSIBLE_SPREAD',
    );
  });

  it('flags a checkpoint stamped before the batch origin', () => {
    const input = {
      provenance: sampleProvenance({
        createdAt: 1_700_000_000,
        checkpoints: [
          { location: 'A', timestamp: 1_600_000_000, dataHash: DATA_HASH },
        ],
      }),
      documents: [invoiceDoc()],
    };
    expect(codesOf(runPack(DATES_CHECKS, input))).toContain(
      'DATES_CHECKPOINT_BEFORE_ORIGIN',
    );
  });

  it('accepts consistent close-together dates', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { date: '2024-01-01T00:00:00.000Z' } }),
        makeDoc('bill_of_lading', { date: '2024-01-15T00:00:00.000Z' }),
      ],
    };
    expect(runPack(DATES_CHECKS, input)).toHaveLength(0);
  });
});
