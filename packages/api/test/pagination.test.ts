import { describe, expect, it } from 'vitest';
import { pageMeta, parsePagination } from '../src/lib/pagination.js';

describe('parsePagination', () => {
  it('applies defaults for an empty query', () => {
    expect(parsePagination({})).toEqual({ limit: 25, offset: 0 });
  });

  it('coerces string query params', () => {
    expect(parsePagination({ limit: '10', offset: '5' })).toEqual({ limit: 10, offset: 5 });
  });

  it('falls back to defaults for invalid values (never throws)', () => {
    expect(parsePagination({ limit: '-3', offset: 'abc' })).toEqual({ limit: 25, offset: 0 });
  });

  it('rejects an over-max limit by falling back to defaults', () => {
    // max is 100; 1000 fails validation → defaults.
    expect(parsePagination({ limit: '1000' })).toEqual({ limit: 25, offset: 0 });
  });

  it('pageMeta echoes total + applied pagination', () => {
    expect(pageMeta(7, { limit: 25, offset: 0 })).toEqual({ total: 7, limit: 25, offset: 0 });
  });
});
