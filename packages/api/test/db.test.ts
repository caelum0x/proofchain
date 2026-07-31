import { afterEach, describe, expect, it } from 'vitest';
// Resolves to test/doubles/infra.ts via the vitest alias.
import { __setRawClient } from '@proofchain/infra';
import { loadConfig } from '../src/config/env.js';
import { createDb } from '../src/lib/db.js';
import { ApiError } from '../src/lib/errors.js';
import { createFakeRawClient, silentLogger, type FakeResult } from './helpers.js';

const configured = loadConfig({
  BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'key',
});

afterEach(() => {
  __setRawClient(null);
});

describe('createDb — unconfigured (no raw client)', () => {
  it('reads return empty and writes are rejected', async () => {
    __setRawClient(null);
    const db = await createDb(configured, silentLogger);
    expect(db.isConfigured).toBe(false);
    expect(await db.list('suppliers')).toEqual([]);
    expect(await db.count('suppliers')).toBe(0);
    expect(await db.getBy('suppliers', 'address', '0x1')).toBeNull();
    await expect(db.upsert('suppliers', {}, 'address')).rejects.toBeInstanceOf(ApiError);
    await expect(db.insert('suppliers', {})).rejects.toBeInstanceOf(ApiError);
  });
});

describe('createDb — live query building', () => {
  it('list applies filters, order and a clamped range', async () => {
    const raw = createFakeRawClient((): FakeResult => ({ data: [{ id: 1 }], error: null }));
    __setRawClient(raw);
    const db = await createDb(configured, silentLogger);
    expect(db.isConfigured).toBe(true);

    const rows = await db.list('deals', {
      filters: { state: 'funded' },
      order: { column: 'created_at', ascending: false },
      limit: 10,
      offset: 20,
    });
    expect(rows).toEqual([{ id: 1 }]);

    const state = raw.lastState();
    expect(state?.table).toBe('deals');
    expect(state?.filters).toEqual({ state: 'funded' });
    expect(state?.order).toEqual({ column: 'created_at', ascending: false });
    expect(state?.range).toEqual([20, 29]);
  });

  it('list clamps limit above the max page size', async () => {
    const raw = createFakeRawClient((): FakeResult => ({ data: [], error: null }));
    __setRawClient(raw);
    const db = await createDb(configured, silentLogger);
    await db.list('deals', { limit: 10_000, offset: 0 });
    // MAX_PAGE_LIMIT is 100 → range [0, 99].
    expect(raw.lastState()?.range).toEqual([0, 99]);
  });

  it('getBy uses maybeSingle and returns the row or null', async () => {
    const raw = createFakeRawClient((): FakeResult => ({ data: { address: '0xabc' }, error: null }));
    __setRawClient(raw);
    const db = await createDb(configured, silentLogger);
    const row = await db.getBy('suppliers', 'address', '0xabc');
    expect(row).toEqual({ address: '0xabc' });
    expect(raw.lastState()?.filters).toEqual({ address: '0xabc' });
  });

  it('upsert targets the conflict column and returns the stored row', async () => {
    const raw = createFakeRawClient(
      (state): FakeResult => ({ data: state.row, error: null }),
    );
    __setRawClient(raw);
    const db = await createDb(configured, silentLogger);
    const stored = await db.upsert('deals', { batch_id: '0x1', state: 'funded' }, 'batch_id');
    expect(stored).toEqual({ batch_id: '0x1', state: 'funded' });
    expect(raw.lastState()?.op).toBe('upsert');
    expect(raw.lastState()?.onConflict).toBe('batch_id');
  });

  it('count issues a head+exact request and returns the count', async () => {
    const raw = createFakeRawClient((): FakeResult => ({ data: null, error: null, count: 42 }));
    __setRawClient(raw);
    const db = await createDb(configured, silentLogger);
    expect(await db.count('deals', { state: 'released' })).toBe(42);
    expect(raw.lastState()?.head).toBe(true);
    expect(raw.lastState()?.count).toBe(true);
  });

  it('surfaces PostgREST errors as a typed DB_ERROR', async () => {
    const raw = createFakeRawClient((): FakeResult => ({ data: null, error: { message: 'boom' } }));
    __setRawClient(raw);
    const db = await createDb(configured, silentLogger);
    await expect(db.list('deals')).rejects.toMatchObject({ code: 'DB_ERROR' });
  });
});
