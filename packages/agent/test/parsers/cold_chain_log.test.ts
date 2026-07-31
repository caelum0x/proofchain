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

describe('cold_chain_log parser', () => {
  const parser = parserRegistry.require('cold_chain_log');

  it('is registered with logistics metadata', () => {
    expect(documentTypes()).toContain('cold_chain_log');
    expect(parser.displayName).toBe('Cold Chain Log');
    expect(parser.domain).toBe('logistics');
    expect(parserFor('cold_chain_log').docType).toBe('cold_chain_log');
  });

  it('detects the document from body keywords', () => {
    const score = parser.detect(
      raw({
        name: 'doc.txt',
        text: 'COLD CHAIN temperature log — data logger, temperature excursion at reefer',
      }),
    );
    expect(score).toBeGreaterThanOrEqual(DETECT_THRESHOLD);
  });

  it('does not claim an unrelated document', () => {
    expect(parser.detect(raw({ name: 'random.dat' }))).toBeLessThan(
      DETECT_THRESHOLD,
    );
  });

  it('classifies a cold chain log from body text', () => {
    expect(
      resolveDocType(
        undefined,
        raw({ name: 'doc.txt', text: 'COLD CHAIN temperature log from data logger' }),
      ),
    ).toBe('cold_chain_log');
  });

  it('schema validates good fields and rejects a bad date', () => {
    expect(parser.schema.safeParse({ date: '2024-06-01', quantity: 1 }).success).toBe(
      true,
    );
    expect(parser.schema.safeParse({ date: false }).success).toBe(false);
  });
});
