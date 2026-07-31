import { describe, expect, it } from 'vitest';
import { runCrossChecks } from '../src/domain/crosscheck.js';
import { mergeFindings, createFinding } from '../src/domain/findings.js';
import { sampleProvenance, invoiceDoc, SAMPLE_BATCH } from './helpers.js';
import type { CrossCheckInput, ParsedDocument } from '../src/domain/types.js';

const codes = (input: CrossCheckInput): string[] =>
  runCrossChecks(input).map((f) => f.code);

describe('runCrossChecks', () => {
  it('flags NO_DOCUMENTS when none supplied', () => {
    const input: CrossCheckInput = {
      provenance: sampleProvenance(),
      documents: [],
    };
    expect(codes(input)).toContain('NO_DOCUMENTS');
  });

  it('flags UNKNOWN_BATCH (critical) when batch is not on-chain', () => {
    const input: CrossCheckInput = {
      provenance: sampleProvenance({ exists: false }),
      documents: [invoiceDoc()],
    };
    const findings = runCrossChecks(input);
    const unknown = findings.find((f) => f.code === 'UNKNOWN_BATCH');
    expect(unknown?.severity).toBe('critical');
  });

  it('flags NO_CHECKPOINTS when provenance trail is empty', () => {
    const input: CrossCheckInput = {
      provenance: sampleProvenance({ checkpoints: [] }),
      documents: [invoiceDoc()],
    };
    expect(codes(input)).toContain('NO_CHECKPOINTS');
  });

  it('passes clean when invoice totals reconcile', () => {
    const input: CrossCheckInput = {
      provenance: sampleProvenance(),
      documents: [invoiceDoc()],
    };
    expect(codes(input)).toHaveLength(0);
  });

  it('flags INVOICE_TOTAL_MISMATCH when line items != total', () => {
    const doc = invoiceDoc({
      fields: {
        total: 5_000, // stated total disagrees with the single 1000 line item
        lineItems: [
          { description: 'w', quantity: 10, unitPrice: 100, amount: 1_000 },
        ],
      },
    });
    const input: CrossCheckInput = {
      provenance: sampleProvenance(),
      documents: [doc],
    };
    expect(codes(input)).toContain('INVOICE_TOTAL_MISMATCH');
  });

  it('flags LINE_ITEM_AMOUNT_MISMATCH when qty*price != amount', () => {
    const doc = invoiceDoc({
      fields: {
        total: 1_500,
        lineItems: [
          { description: 'w', quantity: 10, unitPrice: 100, amount: 1_500 },
        ],
      },
    });
    expect(codes({ provenance: sampleProvenance(), documents: [doc] })).toContain(
      'LINE_ITEM_AMOUNT_MISMATCH',
    );
  });

  it('flags ORIGIN_HASH_MISMATCH (critical) when doc hash != chain', () => {
    const doc = invoiceDoc({
      fields: { originHash: '0xdeadbeef', supplierName: 'Acme' },
    });
    const findings = runCrossChecks({
      provenance: sampleProvenance(),
      documents: [doc],
    });
    expect(findings.find((f) => f.code === 'ORIGIN_HASH_MISMATCH')?.severity).toBe(
      'critical',
    );
  });

  it('accepts matching origin hash (case-insensitive)', () => {
    const doc = invoiceDoc({
      fields: {
        originHash:
          '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
    });
    expect(
      codes({ provenance: sampleProvenance(), documents: [doc] }),
    ).not.toContain('ORIGIN_HASH_MISMATCH');
  });

  it('flags QUANTITY_MISMATCH across documents', () => {
    const a: ParsedDocument = invoiceDoc({
      index: 0,
      fields: { quantity: 100 },
    });
    const b: ParsedDocument = {
      index: 1,
      name: 'bol.pdf',
      docType: 'bill_of_lading',
      sha256: 'b'.repeat(64),
      fields: { quantity: 90 },
    };
    expect(
      codes({ provenance: sampleProvenance(), documents: [a, b] }),
    ).toContain('QUANTITY_MISMATCH');
  });

  it('flags SUPPLIER_MISMATCH across documents', () => {
    const a = invoiceDoc({ index: 0, fields: { supplierName: 'Acme' } });
    const b: ParsedDocument = {
      index: 1,
      name: 'bol.pdf',
      docType: 'bill_of_lading',
      sha256: 'c'.repeat(64),
      fields: { supplierName: 'Globex' },
    };
    expect(
      codes({ provenance: sampleProvenance(), documents: [a, b] }),
    ).toContain('SUPPLIER_MISMATCH');
  });

  it('flags DATE_INCONSISTENCY when doc predates batch registration', () => {
    const doc = invoiceDoc({
      fields: { date: '2000-01-01T00:00:00.000Z', supplierName: 'Acme' },
    });
    expect(codes({ provenance: sampleProvenance(), documents: [doc] })).toContain(
      'DATE_INCONSISTENCY',
    );
  });

  it('flags CHECKPOINT_ORDER when timestamps go backwards', () => {
    const prov = sampleProvenance({
      checkpoints: [
        { location: 'A', timestamp: 200, dataHash: '0x1' as `0x${string}` },
        { location: 'B', timestamp: 100, dataHash: '0x2' as `0x${string}` },
      ],
    });
    expect(codes({ provenance: prov, documents: [invoiceDoc()] })).toContain(
      'CHECKPOINT_ORDER',
    );
  });

  it('is deterministic (same input → same output)', () => {
    const input: CrossCheckInput = {
      provenance: sampleProvenance({ exists: false }),
      documents: [invoiceDoc()],
    };
    expect(runCrossChecks(input)).toEqual(runCrossChecks(input));
  });
});

describe('mergeFindings', () => {
  it('keeps the strictest instance per code and sorts by severity', () => {
    const merged = mergeFindings(
      [createFinding('DUP', 'low', 'a'), createFinding('OTHER', 'medium', 'b')],
      [createFinding('DUP', 'high', 'a-strict')],
    );
    const dup = merged.find((f) => f.code === 'DUP');
    expect(dup?.severity).toBe('high');
    // highest severity first
    expect(merged[0]?.code).toBe('DUP');
  });

  it('does not mutate the inputs', () => {
    const a = [createFinding('X', 'low', 'x')];
    const snapshot = JSON.stringify(a);
    mergeFindings(a, [createFinding('X', 'high', 'x')]);
    expect(JSON.stringify(a)).toBe(snapshot);
  });

  it('uses SAMPLE_BATCH constant without error', () => {
    expect(SAMPLE_BATCH).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
