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

describe('packing_list parser', () => {
  const parser = parserRegistry.require('packing_list');

  it('is registered with logistics metadata', () => {
    expect(documentTypes()).toContain('packing_list');
    expect(parser.displayName).toBe('Packing List');
    expect(parser.domain).toBe('logistics');
    expect(parserFor('packing_list').docType).toBe('packing_list');
  });

  it('detects the document from body keywords', () => {
    const score = parser.detect(
      raw({ name: 'doc.txt', text: 'PACKING LIST — net weight 1200kg, 40 cartons' }),
    );
    expect(score).toBeGreaterThanOrEqual(DETECT_THRESHOLD);
  });

  it('does not claim an unrelated document', () => {
    expect(parser.detect(raw({ name: 'random.dat' }))).toBeLessThan(
      DETECT_THRESHOLD,
    );
  });

  it('classifies a packing list from text', () => {
    expect(
      resolveDocType(
        undefined,
        raw({ name: 'doc.txt', text: 'PACKING LIST — net weight, 40 cartons' }),
      ),
    ).toBe('packing_list');
  });

  it('schema validates good fields and rejects a bad total', () => {
    expect(parser.schema.safeParse({ quantity: 40, total: 5000 }).success).toBe(
      true,
    );
    expect(parser.schema.safeParse({ total: 'nope' }).success).toBe(false);
  });
});
