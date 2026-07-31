import { describe, expect, it } from 'vitest';
import { createRegistry } from '../src/registry/registry.js';
import { AppError } from '../src/errors.js';

interface Item {
  id: string;
  value: number;
}

const mk = (label = 'thing') =>
  createRegistry<Item>({ label, keyOf: (i) => i.id });

describe('createRegistry', () => {
  it('registers and looks up items by key', () => {
    const r = mk();
    r.register({ id: 'a', value: 1 });
    expect(r.has('a')).toBe(true);
    expect(r.get('a')).toEqual({ id: 'a', value: 1 });
    expect(r.size()).toBe(1);
  });

  it('preserves insertion order in all()/keys()', () => {
    const r = mk();
    r.registerAll([
      { id: 'x', value: 1 },
      { id: 'y', value: 2 },
      { id: 'z', value: 3 },
    ]);
    expect(r.keys()).toEqual(['x', 'y', 'z']);
    expect(r.all().map((i) => i.value)).toEqual([1, 2, 3]);
  });

  it('throws CONFIG_ERROR on duplicate keys by default', () => {
    const r = mk('widget');
    r.register({ id: 'dup', value: 1 });
    expect(() => r.register({ id: 'dup', value: 2 })).toThrowError(AppError);
    try {
      r.register({ id: 'dup', value: 3 });
    } catch (err) {
      expect((err as AppError).code).toBe('CONFIG_ERROR');
      expect((err as AppError).message).toContain('widget');
    }
  });

  it('allows override when configured', () => {
    const r = createRegistry<Item>({
      label: 'over',
      keyOf: (i) => i.id,
      allowOverride: true,
    });
    r.register({ id: 'k', value: 1 });
    r.register({ id: 'k', value: 2 });
    expect(r.get('k')?.value).toBe(2);
    expect(r.size()).toBe(1);
  });

  it('rejects an empty key', () => {
    const r = mk();
    expect(() => r.register({ id: '', value: 1 })).toThrowError(AppError);
  });

  it('require() throws for unknown keys, returns for known', () => {
    const r = mk();
    r.register({ id: 'a', value: 1 });
    expect(r.require('a').value).toBe(1);
    expect(() => r.require('missing')).toThrowError(AppError);
  });

  it('reset() clears everything', () => {
    const r = mk();
    r.registerAll([{ id: 'a', value: 1 }]);
    r.reset();
    expect(r.size()).toBe(0);
    expect(r.get('a')).toBeUndefined();
  });
});
