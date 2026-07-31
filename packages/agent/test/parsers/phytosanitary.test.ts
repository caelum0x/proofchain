import { describe, expect, it } from 'vitest';
import {
  DETECT_THRESHOLD,
  documentTypes,
  parserFor,
  parserRegistry,
  resolveDocType,
  type RawDocument,
} from '../../src/parsers/index.js';

const raw = (over: Partial<RawDocument> = {}): RawDocument => ({
  name: 'file.bin',
  mimeType: 'application/octet-stream',
  sizeBytes: 10,
  ...over,
});

describe('phytosanitary parser', () => {
  const parser = parserRegistry.require('phytosanitary');

  it('is registered with compliance metadata', () => {
    expect(documentTypes()).toContain('phytosanitary');
    expect(parser.displayName).toBe('Phytosanitary Certificate');
    expect(parser.domain).toBe('compliance');
    expect(parserFor('phytosanitary').docType).toBe('phytosanitary');
  });

  it('detects the document from body keywords', () => {
    const score = parser.detect(
      raw({
        name: 'doc.txt',
        text: 'PHYTOSANITARY CERTIFICATE — plant protection, IPPC, fumigation applied',
      }),
    );
    expect(score).toBeGreaterThanOrEqual(DETECT_THRESHOLD);
  });

  it('does not claim an unrelated document', () => {
    expect(parser.detect(raw({ name: 'random.dat' }))).toBeLessThan(
      DETECT_THRESHOLD,
    );
  });

  it('classifies a phytosanitary certificate from filename', () => {
    expect(
      resolveDocType(undefined, raw({ name: 'phytosanitary-cert.pdf' })),
    ).toBe('phytosanitary');
  });

  it('schema validates good fields and rejects a bad quantity', () => {
    expect(
      parser.schema.safeParse({ quantity: 500, supplierName: 'Farm Co' }).success,
    ).toBe(true);
    expect(parser.schema.safeParse({ quantity: 'many' }).success).toBe(false);
  });
});
