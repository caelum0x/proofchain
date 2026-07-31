import { describe, expect, it } from 'vitest';
import {
  DETECT_THRESHOLD,
  documentTypes,
  parserFor,
  parserRegistry,
  registerParser,
  resolveDocType,
  type RawDocument,
} from '../src/parsers/index.js';

const raw = (over: Partial<RawDocument> = {}): RawDocument => ({
  name: 'file.bin',
  mimeType: 'application/octet-stream',
  sizeBytes: 10,
  ...over,
});

describe('parser registry (builtins)', () => {
  it('registers invoice, bill_of_lading and unknown', () => {
    const types = documentTypes();
    expect(types).toContain('invoice');
    expect(types).toContain('bill_of_lading');
    expect(types).toContain('unknown');
  });

  it('honours an explicit registered docType', () => {
    expect(resolveDocType('invoice', raw())).toBe('invoice');
    expect(resolveDocType('bill_of_lading', raw())).toBe('bill_of_lading');
  });

  it('classifies by filename when no type is declared', () => {
    expect(
      resolveDocType(undefined, raw({ name: 'commercial-invoice.pdf' })),
    ).toBe('invoice');
  });

  it('classifies by body text for a bill of lading', () => {
    expect(
      resolveDocType(
        undefined,
        raw({ name: 'doc.txt', text: 'OCEAN BILL OF LADING — shipper: Acme' }),
      ),
    ).toBe('bill_of_lading');
  });

  it('falls back to unknown when nothing matches', () => {
    expect(resolveDocType(undefined, raw({ name: 'random.dat' }))).toBe(
      'unknown',
    );
  });

  it('ignores an unregistered declared type and detects instead', () => {
    expect(
      resolveDocType('not_a_real_type', raw({ name: 'invoice-2024.pdf' })),
    ).toBe('invoice');
  });

  it('parserFor returns the unknown parser as a total fallback', () => {
    expect(parserFor('does-not-exist').docType).toBe('unknown');
    expect(parserFor('invoice').docType).toBe('invoice');
  });

  it('the generic parser never claims a document (score 0)', () => {
    const generic = parserRegistry.require('unknown');
    expect(generic.detect(raw({ name: 'anything' }))).toBeLessThan(
      DETECT_THRESHOLD,
    );
  });

  it('invoice schema validates good fields and rejects a bad total', () => {
    const invoice = parserRegistry.require('invoice');
    expect(
      invoice.schema.safeParse({ total: 1000, currency: 'USD' }).success,
    ).toBe(true);
    expect(invoice.schema.safeParse({ total: 'nope' }).success).toBe(false);
  });

  it('supports Fill-agent registration of a new doc type', () => {
    registerParser({
      docType: 'test_certificate',
      displayName: 'Test Certificate',
      domain: 'compliance',
      detect: (r) => (r.name.includes('cert') ? 0.9 : 0),
      schema: parserRegistry.require('unknown').schema,
    });
    expect(documentTypes()).toContain('test_certificate');
    expect(resolveDocType(undefined, raw({ name: 'origin-cert.pdf' }))).toBe(
      'test_certificate',
    );
  });
});
