import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/lib/errors.js';
import {
  hexAddress,
  hexBatchId,
  isHexAddress,
  isHexBatchId,
  jsonSafe,
  parseOr400,
  readView,
  resolveContract,
} from '../src/lib/reads.js';
import { makeChain } from './routers-kit.js';
import type { AppContext } from '../src/context.js';

const ctxWith = (chain: ReturnType<typeof makeChain>): AppContext =>
  ({ chain } as unknown as AppContext);

describe('hex schemas', () => {
  it('lowercases and validates a batch id', () => {
    const v = hexBatchId.parse(`0x${'A'.repeat(64)}`);
    expect(v).toBe(`0x${'a'.repeat(64)}`);
  });

  it('rejects a malformed address', () => {
    expect(hexAddress.safeParse('0x123').success).toBe(false);
  });

  it('guards report hex shape', () => {
    expect(isHexBatchId(`0x${'a'.repeat(64)}`)).toBe(true);
    expect(isHexAddress(`0x${'a'.repeat(40)}`)).toBe(true);
    expect(isHexAddress(`0x${'a'.repeat(64)}`)).toBe(false);
  });
});

describe('parseOr400', () => {
  it('throws a VALIDATION_ERROR ApiError on failure', () => {
    try {
      parseOr400(hexAddress, 'nope');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('jsonSafe', () => {
  it('deep-converts bigints to strings', () => {
    expect(jsonSafe({ a: 1n, b: [2n, { c: 3n }], d: 'x' })).toEqual({
      a: '1',
      b: ['2', { c: '3' }],
      d: 'x',
    });
  });
});

describe('resolveContract / readView', () => {
  it('returns null when the contract is not deployed/known', () => {
    expect(resolveContract(ctxWith(makeChain({})), 'SupplierRegistry')).toBeNull();
  });

  it('reads a view value through the client', async () => {
    const chain = makeChain({ contracts: { SupplierRegistry: true }, reads: { isSupplier: true } });
    const contract = resolveContract(ctxWith(chain), 'SupplierRegistry');
    expect(contract).not.toBeNull();
    const value = await readView(ctxWith(chain), contract!, 'isSupplier', ['0x1']);
    expect(value).toBe(true);
  });

  it('wraps RPC failures as a typed CHAIN_ERROR', async () => {
    const chain = makeChain({
      contracts: { SupplierRegistry: true },
      reads: {
        profileOf: () => {
          throw new Error('rpc exploded');
        },
      },
    });
    const contract = resolveContract(ctxWith(chain), 'SupplierRegistry');
    await expect(readView(ctxWith(chain), contract!, 'profileOf', [])).rejects.toMatchObject({
      code: 'CHAIN_ERROR',
    });
  });
});
