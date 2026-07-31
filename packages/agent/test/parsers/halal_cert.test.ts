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

describe('halal_cert parser', () => {
  const parser = parserRegistry.require('halal_cert');

  it('is registered with compliance metadata', () => {
    expect(documentTypes()).toContain('halal_cert');
    expect(parser.displayName).toBe('Halal Certificate');
    expect(parser.domain).toBe('compliance');
    expect(parserFor('halal_cert').docType).toBe('halal_cert');
  });

  it('detects the document from body keywords', () => {
    const score = parser.detect(
      raw({
        name: 'doc.txt',
        text: 'HALAL CERTIFICATE — shariah compliant, zabihah verified',
      }),
    );
    expect(score).toBeGreaterThanOrEqual(DETECT_THRESHOLD);
  });

  it('does not claim an unrelated document', () => {
    expect(parser.detect(raw({ name: 'random.dat' }))).toBeLessThan(
      DETECT_THRESHOLD,
    );
  });

  it('classifies a halal certificate from filename', () => {
    expect(resolveDocType(undefined, raw({ name: 'halal-certificate.pdf' }))).toBe(
      'halal_cert',
    );
  });

  it('schema validates good fields and rejects bad parties', () => {
    expect(parser.schema.safeParse({ parties: ['Halal Board'] }).success).toBe(
      true,
    );
    expect(parser.schema.safeParse({ parties: 'not-array' }).success).toBe(false);
  });
});
