import { describe, expect, it } from 'vitest';
import { FINANCING_ELIGIBILITY_CHECKS } from '../src/checks/financing_eligibility.js';
import { checkRegistry } from '../src/checks/index.js';
import { sampleProvenance, invoiceDoc } from './helpers.js';
import { makeDoc, runPack, codesOf, cleanInput } from './checks-support.js';

describe('financing-eligibility cross-check pack', () => {
  it('registers its checks', () => {
    for (const c of FINANCING_ELIGIBILITY_CHECKS)
      expect(checkRegistry.has(c.code)).toBe(true);
  });

  it('is silent when no financing is requested', () => {
    expect(runPack(FINANCING_ELIGIBILITY_CHECKS, cleanInput())).toHaveLength(0);
  });

  it('flags financing against an unregistered batch', () => {
    const input = {
      provenance: sampleProvenance({ exists: false }),
      documents: [
        invoiceDoc({ fields: { total: 1_000, currency: 'USD', supplierName: 'Acme' } }),
        makeDoc('letter_of_credit', { total: 1_000, currency: 'USD' }),
      ],
    };
    expect(codesOf(runPack(FINANCING_ELIGIBILITY_CHECKS, input))).toContain(
      'FIN_UNVERIFIED_PROVENANCE',
    );
  });

  it('flags financing with no underlying invoice', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [makeDoc('insurance_cert', { supplierName: 'Acme' })],
    };
    expect(codesOf(runPack(FINANCING_ELIGIBILITY_CHECKS, input))).toContain(
      'FIN_NO_INVOICE',
    );
  });

  it('flags an invoice with no positive value', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        makeDoc('invoice', { supplierName: 'Acme' }),
        makeDoc('letter_of_credit', { total: 1_000 }),
      ],
    };
    expect(codesOf(runPack(FINANCING_ELIGIBILITY_CHECKS, input))).toContain(
      'FIN_NO_INVOICE_VALUE',
    );
  });

  it('flags an unfinanceable currency', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { total: 1_000, currency: 'ZWL', supplierName: 'Acme' } }),
        makeDoc('letter_of_credit', { total: 1_000, currency: 'ZWL' }),
      ],
    };
    expect(codesOf(runPack(FINANCING_ELIGIBILITY_CHECKS, input))).toContain(
      'FIN_UNSUPPORTED_CURRENCY',
    );
  });

  it('flags financing with no identifiable counterparty', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        makeDoc('invoice', { total: 1_000, currency: 'USD' }),
        makeDoc('letter_of_credit', { total: 1_000, currency: 'USD' }),
      ],
    };
    expect(codesOf(runPack(FINANCING_ELIGIBILITY_CHECKS, input))).toContain(
      'FIN_UNKNOWN_COUNTERPARTY',
    );
  });

  it('accepts a fully eligible financing package', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { total: 1_000, currency: 'USD', supplierName: 'Acme' } }),
        makeDoc('letter_of_credit', { total: 1_000, currency: 'USD' }),
      ],
    };
    expect(runPack(FINANCING_ELIGIBILITY_CHECKS, input)).toHaveLength(0);
  });
});
