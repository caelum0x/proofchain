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

describe('dangerous_goods parser', () => {
  const parser = parserRegistry.require('dangerous_goods');

  it('is registered with logistics metadata', () => {
    expect(documentTypes()).toContain('dangerous_goods');
    expect(parser.displayName).toBe('Dangerous Goods Declaration');
    expect(parser.domain).toBe('logistics');
    expect(parserFor('dangerous_goods').docType).toBe('dangerous_goods');
  });

  it('detects the document from body keywords', () => {
    const score = parser.detect(
      raw({
        name: 'doc.txt',
        text: 'DANGEROUS GOODS DECLARATION — UN number 1203, hazard class 3, hazmat',
      }),
    );
    expect(score).toBeGreaterThanOrEqual(DETECT_THRESHOLD);
  });

  it('does not claim an unrelated document', () => {
    expect(parser.detect(raw({ name: 'random.dat' }))).toBeLessThan(
      DETECT_THRESHOLD,
    );
  });

  it('classifies a dangerous goods declaration from text', () => {
    expect(
      resolveDocType(
        undefined,
        raw({
          name: 'doc.txt',
          text: 'DANGEROUS GOODS DECLARATION — UN number 1203, hazard class 3',
        }),
      ),
    ).toBe('dangerous_goods');
  });

  it('schema validates good fields and rejects a bad total', () => {
    expect(parser.schema.safeParse({ quantity: 3, currency: 'USD' }).success).toBe(
      true,
    );
    expect(parser.schema.safeParse({ total: [] }).success).toBe(false);
  });
});
