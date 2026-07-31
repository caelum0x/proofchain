import { describe, expect, it } from 'vitest';
import { PARTIES_CHECKS } from '../src/checks/parties.js';
import { checkRegistry } from '../src/checks/index.js';
import { sampleProvenance, invoiceDoc } from './helpers.js';
import { makeDoc, runPack, codesOf, cleanInput } from './checks-support.js';

describe('parties cross-check pack', () => {
  it('registers its checks', () => {
    for (const c of PARTIES_CHECKS) expect(checkRegistry.has(c.code)).toBe(true);
  });

  it('is silent on a clean single-supplier invoice', () => {
    expect(runPack(PARTIES_CHECKS, cleanInput())).toHaveLength(0);
  });

  it('flags a self-deal (buyer equals supplier)', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { supplierName: 'Acme', buyerName: 'ACME' } }),
      ],
    };
    expect(codesOf(runPack(PARTIES_CHECKS, input))).toContain(
      'PARTIES_SELF_DEAL',
    );
  });

  it('flags an inconsistent buyer across documents', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { supplierName: 'Acme', buyerName: 'Buyer One' } }),
        makeDoc('bill_of_lading', { buyerName: 'Buyer Two' }),
      ],
    };
    expect(codesOf(runPack(PARTIES_CHECKS, input))).toContain(
      'PARTIES_BUYER_MISMATCH',
    );
  });

  it('flags duplicate entries in a parties list', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [makeDoc('bill_of_lading', { parties: ['Acme', 'acme '] })],
    };
    expect(codesOf(runPack(PARTIES_CHECKS, input))).toContain(
      'PARTIES_DUPLICATE',
    );
  });

  it('flags a named party absent from the parties list', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        makeDoc('bill_of_lading', {
          supplierName: 'Acme',
          parties: ['Globex', 'Initech'],
        }),
      ],
    };
    expect(codesOf(runPack(PARTIES_CHECKS, input))).toContain(
      'PARTIES_LIST_INCONSISTENT',
    );
  });

  it('accepts a coherent multi-party set', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { supplierName: 'Acme', buyerName: 'Buyer One' } }),
        makeDoc('bill_of_lading', {
          supplierName: 'Acme',
          parties: ['Acme', 'Buyer One'],
          buyerName: 'Buyer One',
        }),
      ],
    };
    expect(runPack(PARTIES_CHECKS, input)).toHaveLength(0);
  });
});
