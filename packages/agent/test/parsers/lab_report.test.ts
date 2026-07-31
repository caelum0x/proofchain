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

describe('lab_report parser', () => {
  const parser = parserRegistry.require('lab_report');

  it('is registered with quality metadata', () => {
    expect(documentTypes()).toContain('lab_report');
    expect(parser.displayName).toBe('Laboratory Report');
    expect(parser.domain).toBe('quality');
    expect(parserFor('lab_report').docType).toBe('lab_report');
  });

  it('detects the document from body keywords', () => {
    const score = parser.detect(
      raw({
        name: 'doc.txt',
        text: 'CERTIFICATE OF ANALYSIS — laboratory report, assay 99.5%',
      }),
    );
    expect(score).toBeGreaterThanOrEqual(DETECT_THRESHOLD);
  });

  it('does not claim an unrelated document', () => {
    expect(parser.detect(raw({ name: 'random.dat' }))).toBeLessThan(
      DETECT_THRESHOLD,
    );
  });

  it('classifies a lab report from text', () => {
    expect(
      resolveDocType(
        undefined,
        raw({ name: 'doc.txt', text: 'CERTIFICATE OF ANALYSIS — laboratory report, assay 99%' }),
      ),
    ).toBe('lab_report');
  });

  it('schema validates good fields and rejects bad line items', () => {
    expect(
      parser.schema.safeParse({ supplierName: 'Lab Co', date: '2024-03-01' })
        .success,
    ).toBe(true);
    expect(
      parser.schema.safeParse({ lineItems: [{ description: 'x' }] }).success,
    ).toBe(false);
  });
});
