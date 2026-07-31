import { describe, expect, it } from 'vitest';
import { QUANTITY_PRICE_CHECKS } from '../src/checks/quantity_price.js';
import { checkRegistry } from '../src/checks/index.js';
import { sampleProvenance, invoiceDoc } from './helpers.js';
import { makeDoc, runPack, codesOf, cleanInput } from './checks-support.js';

describe('quantity/price cross-check pack', () => {
  it('registers its checks', () => {
    for (const c of QUANTITY_PRICE_CHECKS)
      expect(checkRegistry.has(c.code)).toBe(true);
  });

  it('is silent on a clean invoice', () => {
    expect(runPack(QUANTITY_PRICE_CHECKS, cleanInput())).toHaveLength(0);
  });

  it('flags a non-positive line-item quantity', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({
          fields: {
            lineItems: [
              { description: 'w', quantity: 0, unitPrice: 100, amount: 0 },
            ],
          },
        }),
      ],
    };
    expect(codesOf(runPack(QUANTITY_PRICE_CHECKS, input))).toContain(
      'QP_NONPOSITIVE_QUANTITY',
    );
  });

  it('flags a non-positive unit price', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({
          fields: {
            lineItems: [
              { description: 'w', quantity: 5, unitPrice: -1, amount: -5 },
            ],
          },
        }),
      ],
    };
    expect(codesOf(runPack(QUANTITY_PRICE_CHECKS, input))).toContain(
      'QP_NONPOSITIVE_PRICE',
    );
  });

  it('flags an implausibly high unit price', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({
          fields: {
            lineItems: [
              { description: 'w', quantity: 1, unitPrice: 5e9, amount: 5e9 },
            ],
          },
        }),
      ],
    };
    expect(codesOf(runPack(QUANTITY_PRICE_CHECKS, input))).toContain(
      'QP_IMPLAUSIBLE_UNIT_PRICE',
    );
  });

  it('reconciles line items for non-invoice value documents', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        makeDoc('packing_list', {
          total: 999,
          lineItems: [
            { description: 'w', quantity: 2, unitPrice: 100, amount: 200 },
          ],
        }),
      ],
    };
    expect(codesOf(runPack(QUANTITY_PRICE_CHECKS, input))).toContain(
      'QP_TOTAL_RECONCILE_MISMATCH',
    );
  });

  it('does not double-flag invoice totals (owned by the core rule)', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({
          fields: {
            total: 999,
            lineItems: [
              { description: 'w', quantity: 2, unitPrice: 100, amount: 200 },
            ],
          },
        }),
      ],
    };
    expect(codesOf(runPack(QUANTITY_PRICE_CHECKS, input))).not.toContain(
      'QP_TOTAL_RECONCILE_MISMATCH',
    );
  });
});
