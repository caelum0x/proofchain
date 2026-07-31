import { describe, expect, it } from 'vitest';
import { COLD_CHAIN_CHECKS } from '../src/checks/cold_chain.js';
import { checkRegistry } from '../src/checks/index.js';
import { sampleProvenance, invoiceDoc } from './helpers.js';
import { makeDoc, runPack, codesOf, cleanInput } from './checks-support.js';
import type { Hex } from '../src/domain/types.js';

const DATA_HASH = `0x${'c'.repeat(64)}` as Hex;

describe('cold-chain cross-check pack', () => {
  it('registers its checks', () => {
    for (const c of COLD_CHAIN_CHECKS)
      expect(checkRegistry.has(c.code)).toBe(true);
  });

  it('is silent when no cold-chain log is present', () => {
    expect(runPack(COLD_CHAIN_CHECKS, cleanInput())).toHaveLength(0);
  });

  it('flags a cold-chain log without corroborating checkpoints', () => {
    const input = {
      provenance: sampleProvenance({ checkpoints: [] }),
      documents: [makeDoc('cold_chain_log', { supplierName: 'Acme' })],
    };
    expect(codesOf(runPack(COLD_CHAIN_CHECKS, input))).toContain(
      'COLD_CHAIN_NO_CHECKPOINTS',
    );
  });

  it('flags a log dated before the batch origin', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        makeDoc('cold_chain_log', { date: '2000-01-01T00:00:00.000Z' }),
      ],
    };
    expect(codesOf(runPack(COLD_CHAIN_CHECKS, input))).toContain(
      'COLD_CHAIN_LOG_BEFORE_ORIGIN',
    );
  });

  it('flags a monitoring gap larger than the 6h limit', () => {
    const input = {
      provenance: sampleProvenance({
        checkpoints: [
          { location: 'A', timestamp: 1_700_000_100, dataHash: DATA_HASH },
          { location: 'B', timestamp: 1_700_000_100 + 60 * 60 * 24, dataHash: DATA_HASH },
        ],
      }),
      documents: [makeDoc('cold_chain_log', { supplierName: 'Acme' })],
    };
    expect(codesOf(runPack(COLD_CHAIN_CHECKS, input))).toContain(
      'COLD_CHAIN_MONITORING_GAP',
    );
  });

  it('flags a log naming a different supplier than the invoice', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { supplierName: 'Acme' } }),
        makeDoc('cold_chain_log', { supplierName: 'Globex' }),
      ],
    };
    expect(codesOf(runPack(COLD_CHAIN_CHECKS, input))).toContain(
      'COLD_CHAIN_SUPPLIER_MISMATCH',
    );
  });

  it('accepts a well-corroborated cold-chain log', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { supplierName: 'Acme' } }),
        makeDoc('cold_chain_log', {
          supplierName: 'Acme',
          date: '2024-01-01T00:00:00.000Z',
        }),
      ],
    };
    expect(runPack(COLD_CHAIN_CHECKS, input)).toHaveLength(0);
  });
});
