import { describe, expect, it } from 'vitest';
import { asNumber, enumToken, lower, secondsToIso, str } from '../../src/indexer/handlers/util.js';

describe('handler util', () => {
  it('str narrows only strings', () => {
    expect(str('0xAbC')).toBe('0xAbC');
    expect(str(5)).toBeUndefined();
    expect(str(undefined)).toBeUndefined();
  });

  it('lower lowercases hex strings', () => {
    expect(lower('0xABCD')).toBe('0xabcd');
    expect(lower(123)).toBeUndefined();
  });

  it('asNumber accepts numbers and numeric strings', () => {
    expect(asNumber(7)).toBe(7);
    expect(asNumber('42')).toBe(42);
    expect(asNumber('')).toBeUndefined();
    expect(asNumber('nope')).toBeUndefined();
    expect(asNumber(Number.NaN)).toBeUndefined();
  });

  it('secondsToIso converts unix seconds and treats 0/invalid as null', () => {
    expect(secondsToIso('1893456000')).toBe(new Date(1893456000 * 1000).toISOString());
    expect(secondsToIso(1893456000)).toBe(new Date(1893456000 * 1000).toISOString());
    expect(secondsToIso('0')).toBeNull();
    expect(secondsToIso(undefined)).toBeNull();
    expect(secondsToIso('bad')).toBeNull();
  });

  it('enumToken maps a numeric key to a lowercased label, else fallback', () => {
    const labels = { 0: 'Solar', 1: 'Wind' } as const;
    expect(enumToken(labels, 1, 'solar')).toBe('wind');
    expect(enumToken(labels, 99, 'solar')).toBe('solar');
    expect(enumToken(labels, undefined, 'solar')).toBe('solar');
  });
});
