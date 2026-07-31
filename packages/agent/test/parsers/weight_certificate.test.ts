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

describe('weight_certificate parser', () => {
  const parser = parserRegistry.require('weight_certificate');

  it('is registered with logistics metadata', () => {
    expect(documentTypes()).toContain('weight_certificate');
    expect(parser.displayName).toBe('Weight Certificate');
    expect(parser.domain).toBe('logistics');
    expect(parserFor('weight_certificate').docType).toBe('weight_certificate');
  });

  it('detects the document from body keywords', () => {
    const score = parser.detect(
      raw({
        name: 'doc.txt',
        text: 'WEIGHT CERTIFICATE — weighbridge reading, tare weight 2t, gross weight 22t',
      }),
    );
    expect(score).toBeGreaterThanOrEqual(DETECT_THRESHOLD);
  });

  it('does not claim an unrelated document', () => {
    expect(parser.detect(raw({ name: 'random.dat' }))).toBeLessThan(
      DETECT_THRESHOLD,
    );
  });

  it('classifies a weight certificate from text', () => {
    expect(
      resolveDocType(
        undefined,
        raw({
          name: 'doc.txt',
          text: 'WEIGHT CERTIFICATE — weighbridge, tare weight, gross weight',
        }),
      ),
    ).toBe('weight_certificate');
  });

  it('schema validates good fields and rejects a bad quantity', () => {
    expect(parser.schema.safeParse({ quantity: 22000 }).success).toBe(true);
    expect(parser.schema.safeParse({ quantity: '22t' }).success).toBe(false);
  });
});
