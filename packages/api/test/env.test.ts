import { describe, expect, it } from 'vitest';
import { isSupabaseConfigured, loadConfig } from '../src/config/env.js';
import { ApiError } from '../src/lib/errors.js';

const base = {
  BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
};

describe('loadConfig', () => {
  it('applies defaults for a minimal valid env', () => {
    const cfg = loadConfig({ ...base });
    expect(cfg.API_PORT).toBe(8081);
    expect(cfg.CHAIN_ID).toBe(11_155_111);
    expect(cfg.CORS_ORIGIN).toBe('*');
    expect(cfg.INDEXER_ENABLED).toBe(false);
    expect(cfg.INDEXER_BLOCK_RANGE).toBe(2000n);
    expect(cfg.INDEXER_CONFIRMATIONS).toBe(2n);
    expect(isSupabaseConfigured(cfg)).toBe(false);
  });

  it('throws a CONFIG_ERROR ApiError (not a ZodError) when RPC is missing', () => {
    try {
      loadConfig({});
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('CONFIG_ERROR');
    }
  });

  it('rejects a malformed RPC URL', () => {
    expect(() => loadConfig({ BASE_SEPOLIA_RPC_URL: 'not-a-url' })).toThrow(ApiError);
  });

  it('treats empty Supabase strings as absent (graceful, not invalid)', () => {
    const cfg = loadConfig({ ...base, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' });
    expect(isSupabaseConfigured(cfg)).toBe(false);
  });

  it('marks Supabase configured only when BOTH url and key are present', () => {
    const cfg = loadConfig({
      ...base,
      SUPABASE_URL: 'https://proj.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    });
    expect(isSupabaseConfigured(cfg)).toBe(true);
  });

  it('parses booleanish INDEXER_ENABLED and bigint ranges', () => {
    const cfg = loadConfig({
      ...base,
      INDEXER_ENABLED: '1',
      INDEXER_BLOCK_RANGE: '500',
      INDEXER_START_BLOCK: '123456',
    });
    expect(cfg.INDEXER_ENABLED).toBe(true);
    expect(cfg.INDEXER_BLOCK_RANGE).toBe(500n);
    expect(cfg.INDEXER_START_BLOCK).toBe(123456n);
  });

  it('rejects a non-numeric block range', () => {
    expect(() => loadConfig({ ...base, INDEXER_BLOCK_RANGE: 'ten' })).toThrow(ApiError);
  });
});
