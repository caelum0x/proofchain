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

describe('customs_declaration parser', () => {
  const parser = parserRegistry.require('customs_declaration');

  it('is registered with customs metadata', () => {
    expect(documentTypes()).toContain('customs_declaration');
    expect(parser.displayName).toBe('Customs Declaration');
    expect(parser.domain).toBe('customs');
    expect(parserFor('customs_declaration').docType).toBe('customs_declaration');
  });

  it('detects the document from body keywords', () => {
    const score = parser.detect(
      raw({
        name: 'doc.txt',
        text: 'CUSTOMS DECLARATION — single administrative document, HS code 0901, declared value 5000',
      }),
    );
    expect(score).toBeGreaterThanOrEqual(DETECT_THRESHOLD);
  });

  it('does not claim an unrelated document', () => {
    expect(parser.detect(raw({ name: 'random.dat' }))).toBeLessThan(
      DETECT_THRESHOLD,
    );
  });

  it('classifies a customs declaration from filename', () => {
    expect(
      resolveDocType(undefined, raw({ name: 'customs-declaration.pdf' })),
    ).toBe('customs_declaration');
  });

  it('schema validates good fields and rejects a bad total', () => {
    expect(parser.schema.safeParse({ total: 5000, currency: 'EUR' }).success).toBe(
      true,
    );
    expect(parser.schema.safeParse({ total: {} }).success).toBe(false);
  });
});
