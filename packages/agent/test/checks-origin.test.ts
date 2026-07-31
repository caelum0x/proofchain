import { describe, expect, it } from 'vitest';
import { ORIGIN_CHECKS } from '../src/checks/origin.js';
import { checkRegistry } from '../src/checks/index.js';
import { sampleProvenance, invoiceDoc } from './helpers.js';
import { makeDoc, runPack, codesOf, cleanInput } from './checks-support.js';

describe('origin cross-check pack', () => {
  it('registers its checks', () => {
    for (const c of ORIGIN_CHECKS) expect(checkRegistry.has(c.code)).toBe(true);
  });

  it('is silent when no certificate of origin is present', () => {
    expect(runPack(ORIGIN_CHECKS, cleanInput())).toHaveLength(0);
  });

  it('flags a supplier mismatch between certificate and invoice', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { supplierName: 'Acme' } }),
        makeDoc('certificate_of_origin', { supplierName: 'Globex' }),
      ],
    };
    expect(codesOf(runPack(ORIGIN_CHECKS, input))).toContain(
      'ORIGIN_SUPPLIER_MISMATCH',
    );
  });

  it('flags a certificate that identifies no producer', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [makeDoc('certificate_of_origin', {})],
    };
    expect(codesOf(runPack(ORIGIN_CHECKS, input))).toContain(
      'ORIGIN_CERT_INCOMPLETE',
    );
  });

  it('flags a certificate dated before the batch', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        makeDoc('certificate_of_origin', {
          supplierName: 'Acme',
          date: '2000-01-01T00:00:00.000Z',
        }),
      ],
    };
    expect(codesOf(runPack(ORIGIN_CHECKS, input))).toContain(
      'ORIGIN_CERT_PREDATES_BATCH',
    );
  });

  it('accepts a consistent certificate', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { supplierName: 'Acme' } }),
        makeDoc('certificate_of_origin', {
          supplierName: 'Acme',
          date: '2024-01-01T00:00:00.000Z',
        }),
      ],
    };
    expect(runPack(ORIGIN_CHECKS, input)).toHaveLength(0);
  });
});
