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

describe('delivery_note parser', () => {
  const parser = parserRegistry.require('delivery_note');

  it('is registered with logistics metadata', () => {
    expect(documentTypes()).toContain('delivery_note');
    expect(parser.displayName).toBe('Delivery Note');
    expect(parser.domain).toBe('logistics');
    expect(parserFor('delivery_note').docType).toBe('delivery_note');
  });

  it('detects the document from body keywords', () => {
    const score = parser.detect(
      raw({
        name: 'doc.txt',
        text: 'DELIVERY NOTE — proof of delivery, goods received, received by J. Doe',
      }),
    );
    expect(score).toBeGreaterThanOrEqual(DETECT_THRESHOLD);
  });

  it('does not claim an unrelated document', () => {
    expect(parser.detect(raw({ name: 'random.dat' }))).toBeLessThan(
      DETECT_THRESHOLD,
    );
  });

  it('classifies a delivery note from text', () => {
    expect(
      resolveDocType(
        undefined,
        raw({ name: 'doc.txt', text: 'DELIVERY NOTE — proof of delivery, goods received' }),
      ),
    ).toBe('delivery_note');
  });

  it('schema validates good fields and rejects a bad quantity', () => {
    expect(parser.schema.safeParse({ quantity: 12, date: '2024-05-01' }).success).toBe(
      true,
    );
    expect(parser.schema.safeParse({ quantity: null }).success).toBe(false);
  });
});
