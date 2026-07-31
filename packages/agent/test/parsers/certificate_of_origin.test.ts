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

describe('certificate_of_origin parser', () => {
  const parser = parserRegistry.require('certificate_of_origin');

  it('is registered with compliance metadata', () => {
    expect(documentTypes()).toContain('certificate_of_origin');
    expect(parser.displayName).toBe('Certificate of Origin');
    expect(parser.domain).toBe('compliance');
    expect(parserFor('certificate_of_origin').docType).toBe(
      'certificate_of_origin',
    );
  });

  it('detects the document from body keywords', () => {
    const score = parser.detect(
      raw({
        name: 'doc.txt',
        text: 'CERTIFICATE OF ORIGIN — country of origin: India, chamber of commerce',
      }),
    );
    expect(score).toBeGreaterThanOrEqual(DETECT_THRESHOLD);
  });

  it('does not claim an unrelated document', () => {
    expect(parser.detect(raw({ name: 'random.dat' }))).toBeLessThan(
      DETECT_THRESHOLD,
    );
  });

  it('classifies a certificate of origin from text', () => {
    expect(
      resolveDocType(
        undefined,
        raw({ name: 'doc.txt', text: 'CERTIFICATE OF ORIGIN, country of origin: India' }),
      ),
    ).toBe('certificate_of_origin');
  });

  it('schema validates good fields and rejects a bad parties array', () => {
    expect(
      parser.schema.safeParse({ parties: ['Acme'], originHash: 'abc' }).success,
    ).toBe(true);
    expect(parser.schema.safeParse({ parties: [1, 2] }).success).toBe(false);
  });
});
