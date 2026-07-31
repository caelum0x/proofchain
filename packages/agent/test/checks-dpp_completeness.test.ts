import { describe, expect, it } from 'vitest';
import { DPP_COMPLETENESS_CHECKS } from '../src/checks/dpp_completeness.js';
import { checkRegistry } from '../src/checks/index.js';
import { sampleProvenance, invoiceDoc } from './helpers.js';
import { makeDoc, runPack, codesOf, cleanInput } from './checks-support.js';

describe('DPP completeness cross-check pack', () => {
  it('registers its checks', () => {
    for (const c of DPP_COMPLETENESS_CHECKS)
      expect(checkRegistry.has(c.code)).toBe(true);
  });

  it('is silent when no dossier is being presented', () => {
    expect(runPack(DPP_COMPLETENESS_CHECKS, cleanInput())).toHaveLength(0);
  });

  it('flags a dossier missing its on-chain data carrier', () => {
    const input = {
      provenance: sampleProvenance({ metadataURI: '' }),
      documents: [
        invoiceDoc({ fields: { supplierName: 'Acme' } }),
        makeDoc('certificate_of_origin', { supplierName: 'Acme' }),
      ],
    };
    expect(codesOf(runPack(DPP_COMPLETENESS_CHECKS, input))).toContain(
      'DPP_MISSING_DATA_CARRIER',
    );
  });

  it('flags a dossier with no commercial invoice', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [makeDoc('certificate_of_origin', { supplierName: 'Acme' })],
    };
    expect(codesOf(runPack(DPP_COMPLETENESS_CHECKS, input))).toContain(
      'DPP_MISSING_COMMERCIAL_RECORD',
    );
  });

  it('flags a dossier with no lifecycle checkpoints', () => {
    const input = {
      provenance: sampleProvenance({ checkpoints: [] }),
      documents: [
        invoiceDoc({ fields: { supplierName: 'Acme' } }),
        makeDoc('certificate_of_origin', { supplierName: 'Acme' }),
      ],
    };
    expect(codesOf(runPack(DPP_COMPLETENESS_CHECKS, input))).toContain(
      'DPP_MISSING_LIFECYCLE',
    );
  });

  it('flags a dossier naming no economic operator', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        makeDoc('invoice', { total: 100 }),
        makeDoc('certificate_of_origin', {}),
      ],
    };
    expect(codesOf(runPack(DPP_COMPLETENESS_CHECKS, input))).toContain(
      'DPP_MISSING_ECONOMIC_OPERATOR',
    );
  });

  it('accepts a complete dossier', () => {
    const input = {
      provenance: sampleProvenance(),
      documents: [
        invoiceDoc({ fields: { supplierName: 'Acme' } }),
        makeDoc('certificate_of_origin', { supplierName: 'Acme' }),
      ],
    };
    expect(runPack(DPP_COMPLETENESS_CHECKS, input)).toHaveLength(0);
  });
});
