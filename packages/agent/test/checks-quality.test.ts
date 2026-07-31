import { describe, expect, it } from 'vitest';
import { QUALITY_CHECKS } from '../src/checks/quality.js';
import { checkRegistry } from '../src/checks/index.js';
import { sampleProvenance, invoiceDoc } from './helpers.js';
import { makeDoc, runPack, codesOf, cleanInput } from './checks-support.js';

describe('quality cross-check pack', () => {
  it('registers its checks', () => {
    for (const c of QUALITY_CHECKS) expect(checkRegistry.has(c.code)).toBe(true);
  });

  it('is silent when no quality report is present', () => {
    expect(runPack(QUALITY_CHECKS, cleanInput())).toHaveLength(0);
  });

  it('flags a supplier mismatch between report and invoice', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { supplierName: 'Acme' } }),
        makeDoc('inspection_report', { supplierName: 'Globex', quantity: 10 }),
      ],
    };
    expect(codesOf(runPack(QUALITY_CHECKS, input))).toContain(
      'QUALITY_SUPPLIER_MISMATCH',
    );
  });

  it('flags a quantity mismatch between report and invoice', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { quantity: 100, supplierName: 'Acme' } }),
        makeDoc('lab_report', { quantity: 90, supplierName: 'Acme' }),
      ],
    };
    expect(codesOf(runPack(QUALITY_CHECKS, input))).toContain(
      'QUALITY_QUANTITY_MISMATCH',
    );
  });

  it('flags an inspection dated before the batch was registered', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        makeDoc('inspection_report', {
          supplierName: 'Acme',
          date: '2000-01-01T00:00:00.000Z',
        }),
      ],
    };
    expect(codesOf(runPack(QUALITY_CHECKS, input))).toContain(
      'QUALITY_STALE_INSPECTION',
    );
  });

  it('flags an empty report with no verifiable fields', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [makeDoc('lab_report', {})],
    };
    expect(codesOf(runPack(QUALITY_CHECKS, input))).toContain(
      'QUALITY_EMPTY_REPORT',
    );
  });

  it('accepts a consistent, dated report', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { quantity: 10, supplierName: 'Acme' } }),
        makeDoc('inspection_report', {
          supplierName: 'Acme',
          quantity: 10,
          date: '2024-01-01T00:00:00.000Z',
        }),
      ],
    };
    expect(runPack(QUALITY_CHECKS, input)).toHaveLength(0);
  });
});
