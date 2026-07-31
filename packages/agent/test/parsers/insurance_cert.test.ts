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

describe('insurance_cert parser', () => {
  const parser = parserRegistry.require('insurance_cert');

  it('is registered with insurance metadata', () => {
    expect(documentTypes()).toContain('insurance_cert');
    expect(parser.displayName).toBe('Insurance Certificate');
    expect(parser.domain).toBe('insurance');
    expect(parserFor('insurance_cert').docType).toBe('insurance_cert');
  });

  it('detects the document from body keywords', () => {
    const score = parser.detect(
      raw({
        name: 'doc.txt',
        text: 'CERTIFICATE OF INSURANCE — marine insurance, policy no A123, sum insured 100000',
      }),
    );
    expect(score).toBeGreaterThanOrEqual(DETECT_THRESHOLD);
  });

  it('does not claim an unrelated document', () => {
    expect(parser.detect(raw({ name: 'random.dat' }))).toBeLessThan(
      DETECT_THRESHOLD,
    );
  });

  it('classifies an insurance certificate from text', () => {
    expect(
      resolveDocType(
        undefined,
        raw({
          name: 'doc.txt',
          text: 'CERTIFICATE OF INSURANCE — marine insurance, policy no A1, sum insured 100000',
        }),
      ),
    ).toBe('insurance_cert');
  });

  it('schema validates good fields and rejects a bad total', () => {
    expect(parser.schema.safeParse({ total: 100000, currency: 'USD' }).success).toBe(
      true,
    );
    expect(parser.schema.safeParse({ total: 'lots' }).success).toBe(false);
  });
});
