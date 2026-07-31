import { describe, expect, it } from 'vitest';
import { CUSTOMS_CHECKS } from '../src/checks/customs.js';
import { checkRegistry } from '../src/checks/index.js';
import { sampleProvenance, invoiceDoc } from './helpers.js';
import { makeDoc, runPack, codesOf, cleanInput } from './checks-support.js';

describe('customs cross-check pack', () => {
  it('registers its checks', () => {
    for (const c of CUSTOMS_CHECKS) expect(checkRegistry.has(c.code)).toBe(true);
  });

  it('is silent when no customs declaration is present', () => {
    expect(runPack(CUSTOMS_CHECKS, cleanInput())).toHaveLength(0);
  });

  it('flags a declared value that undercuts the invoice total', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { total: 10_000, currency: 'USD' } }),
        makeDoc('customs_declaration', {
          total: 4_000,
          currency: 'USD',
          supplierName: 'Acme',
        }),
      ],
    };
    expect(codesOf(runPack(CUSTOMS_CHECKS, input))).toContain(
      'CUSTOMS_VALUE_MISMATCH',
    );
  });

  it('flags a quantity mismatch against the invoice', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { quantity: 100 } }),
        makeDoc('customs_declaration', { quantity: 80, supplierName: 'Acme' }),
      ],
    };
    expect(codesOf(runPack(CUSTOMS_CHECKS, input))).toContain(
      'CUSTOMS_QUANTITY_MISMATCH',
    );
  });

  it('flags a declaration that names no parties', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [makeDoc('customs_declaration', { total: 100, currency: 'USD' })],
    };
    expect(codesOf(runPack(CUSTOMS_CHECKS, input))).toContain(
      'CUSTOMS_MISSING_PARTIES',
    );
  });

  it('flags a valued declaration with no currency', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [makeDoc('customs_declaration', { total: 100, supplierName: 'Acme' })],
    };
    expect(codesOf(runPack(CUSTOMS_CHECKS, input))).toContain(
      'CUSTOMS_MISSING_CURRENCY',
    );
  });

  it('accepts a consistent declaration', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { total: 5_000, currency: 'USD', quantity: 50 } }),
        makeDoc('customs_declaration', {
          total: 5_000,
          currency: 'USD',
          quantity: 50,
          supplierName: 'Acme',
        }),
      ],
    };
    expect(runPack(CUSTOMS_CHECKS, input)).toHaveLength(0);
  });
});
