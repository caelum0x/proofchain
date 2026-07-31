import { describe, expect, it } from 'vitest';
import { TRADE_CHECKS } from '../src/checks/trade.js';
import { checkRegistry } from '../src/checks/index.js';
import { sampleProvenance, invoiceDoc } from './helpers.js';
import { makeDoc, runPack, codesOf, cleanInput } from './checks-support.js';

describe('trade cross-check pack', () => {
  it('registers its checks under the trade domain', () => {
    for (const c of TRADE_CHECKS) expect(checkRegistry.has(c.code)).toBe(true);
  });

  it('is silent on a clean single-invoice input', () => {
    expect(runPack(TRADE_CHECKS, cleanInput())).toHaveLength(0);
  });

  it('flags conflicting currencies across documents', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { total: 100, currency: 'USD' } }),
        makeDoc('packing_list', { currency: 'EUR' }),
      ],
    };
    expect(codesOf(runPack(TRADE_CHECKS, input))).toContain(
      'TRADE_CURRENCY_MISMATCH',
    );
  });

  it('flags an invalid ISO-4217 currency code', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [invoiceDoc({ fields: { total: 100, currency: 'US$' } })],
    };
    expect(codesOf(runPack(TRADE_CHECKS, input))).toContain(
      'TRADE_CURRENCY_INVALID',
    );
  });

  it('flags a non-positive invoice total', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [invoiceDoc({ fields: { total: 0, currency: 'USD' } })],
    };
    expect(codesOf(runPack(TRADE_CHECKS, input))).toContain(
      'TRADE_NONPOSITIVE_TOTAL',
    );
  });

  it('reconciles invoice against an accompanying letter of credit', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { total: 1_000, currency: 'USD' } }),
        makeDoc('letter_of_credit', { total: 900, currency: 'USD' }),
      ],
    };
    expect(codesOf(runPack(TRADE_CHECKS, input))).toContain(
      'TRADE_INVOICE_LC_MISMATCH',
    );
  });

  it('accepts a matching invoice/LC pair', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { total: 1_000, currency: 'USD' } }),
        makeDoc('letter_of_credit', { total: 1_000, currency: 'USD' }),
      ],
    };
    expect(codesOf(runPack(TRADE_CHECKS, input))).not.toContain(
      'TRADE_INVOICE_LC_MISMATCH',
    );
  });
});
