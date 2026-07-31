import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env.js';
import { AppError } from '../src/errors.js';

const REQUIRED = {
  ANTHROPIC_API_KEY: 'k',
  AGENT_PRIVATE_KEY: `0x${'a'.repeat(64)}`,
  BASE_SEPOLIA_RPC_URL: 'https://rpc.example',
};

describe('loadConfig', () => {
  it('loads with defaults when only required vars are present', () => {
    const config = loadConfig(REQUIRED);
    expect(config.CHAIN_ID).toBe(84_532);
    expect(config.PASS_THRESHOLD_BPS).toBe(7_000);
    expect(config.SETTLE_ON_ATTEST).toBe(false);
    expect(config.PORT).toBe(8_080);
    expect(config.ANTHROPIC_MODEL).toBe('claude-opus-4-8');
  });

  it('fails fast (CONFIG_ERROR) when a required secret is missing', () => {
    expect(() =>
      loadConfig({ AGENT_PRIVATE_KEY: REQUIRED.AGENT_PRIVATE_KEY }),
    ).toThrow(AppError);
  });

  it('rejects a malformed private key', () => {
    expect(() =>
      loadConfig({ ...REQUIRED, AGENT_PRIVATE_KEY: '0xnothex' }),
    ).toThrow(AppError);
  });

  it('rejects a non-URL RPC endpoint', () => {
    expect(() =>
      loadConfig({ ...REQUIRED, BASE_SEPOLIA_RPC_URL: 'localhost' }),
    ).toThrow(AppError);
  });

  it('coerces SETTLE_ON_ATTEST from string', () => {
    expect(loadConfig({ ...REQUIRED, SETTLE_ON_ATTEST: 'true' }).SETTLE_ON_ATTEST).toBe(
      true,
    );
    expect(loadConfig({ ...REQUIRED, SETTLE_ON_ATTEST: '1' }).SETTLE_ON_ATTEST).toBe(
      true,
    );
    expect(loadConfig({ ...REQUIRED, SETTLE_ON_ATTEST: 'false' }).SETTLE_ON_ATTEST).toBe(
      false,
    );
  });

  it('rejects an out-of-range pass threshold', () => {
    expect(() =>
      loadConfig({ ...REQUIRED, PASS_THRESHOLD_BPS: '20000' }),
    ).toThrow(AppError);
  });

  it('produces a readable CONFIG_ERROR message listing issues', () => {
    try {
      loadConfig({});
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('CONFIG_ERROR');
      expect((err as AppError).message).toContain('ANTHROPIC_API_KEY');
    }
  });
});
