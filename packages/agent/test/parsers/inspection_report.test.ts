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

describe('inspection_report parser', () => {
  const parser = parserRegistry.require('inspection_report');

  it('is registered with quality metadata', () => {
    expect(documentTypes()).toContain('inspection_report');
    expect(parser.displayName).toBe('Inspection Report');
    expect(parser.domain).toBe('quality');
    expect(parserFor('inspection_report').docType).toBe('inspection_report');
  });

  it('detects the document from body keywords', () => {
    const score = parser.detect(
      raw({
        name: 'doc.txt',
        text: 'PRE-SHIPMENT INSPECTION REPORT — inspected by SGS, inspection date 2024-01-02',
      }),
    );
    expect(score).toBeGreaterThanOrEqual(DETECT_THRESHOLD);
  });

  it('does not claim an unrelated document', () => {
    expect(parser.detect(raw({ name: 'random.dat' }))).toBeLessThan(
      DETECT_THRESHOLD,
    );
  });

  it('classifies an inspection report from text', () => {
    expect(
      resolveDocType(
        undefined,
        raw({ name: 'doc.txt', text: 'PRE-SHIPMENT INSPECTION REPORT — inspected by SGS' }),
      ),
    ).toBe('inspection_report');
  });

  it('schema validates good fields and rejects a bad date', () => {
    expect(parser.schema.safeParse({ date: '2024-01-02' }).success).toBe(true);
    expect(parser.schema.safeParse({ date: 20240102 }).success).toBe(false);
  });
});
