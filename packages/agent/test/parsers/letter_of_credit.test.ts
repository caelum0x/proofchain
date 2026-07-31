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

describe('letter_of_credit parser', () => {
  const parser = parserRegistry.require('letter_of_credit');

  it('is registered with trade metadata', () => {
    expect(documentTypes()).toContain('letter_of_credit');
    expect(parser.displayName).toBe('Letter of Credit');
    expect(parser.domain).toBe('trade');
    expect(parserFor('letter_of_credit').docType).toBe('letter_of_credit');
  });

  it('detects the document from body keywords', () => {
    const score = parser.detect(
      raw({
        name: 'doc.txt',
        text: 'IRREVOCABLE DOCUMENTARY LETTER OF CREDIT — issuing bank, beneficiary, UCP 600',
      }),
    );
    expect(score).toBeGreaterThanOrEqual(DETECT_THRESHOLD);
  });

  it('does not claim an unrelated document', () => {
    expect(parser.detect(raw({ name: 'random.dat' }))).toBeLessThan(
      DETECT_THRESHOLD,
    );
  });

  it('classifies a letter of credit from text', () => {
    expect(
      resolveDocType(
        undefined,
        raw({
          name: 'doc.txt',
          text: 'IRREVOCABLE DOCUMENTARY LETTER OF CREDIT — issuing bank, beneficiary',
        }),
      ),
    ).toBe('letter_of_credit');
  });

  it('schema validates good fields and rejects a bad currency', () => {
    expect(parser.schema.safeParse({ total: 250000, currency: 'USD' }).success).toBe(
      true,
    );
    expect(parser.schema.safeParse({ currency: 42 }).success).toBe(false);
  });
});
