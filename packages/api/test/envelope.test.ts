import { describe, expect, it } from 'vitest';
import { fail, ok, okPage } from '../src/lib/envelope.js';

describe('envelope', () => {
  it('ok wraps data with null error', () => {
    expect(ok({ a: 1 })).toEqual({ success: true, data: { a: 1 }, error: null });
  });

  it('okPage carries pagination meta', () => {
    const env = okPage([1, 2], { total: 10, limit: 2, offset: 0 });
    expect(env.success).toBe(true);
    expect(env.data).toEqual([1, 2]);
    expect(env.meta).toEqual({ total: 10, limit: 2, offset: 0 });
  });

  it('fail nulls data and carries the error payload', () => {
    const env = fail({ code: 'NOT_FOUND', message: 'nope' });
    expect(env).toEqual({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'nope' },
    });
  });
});
