/**
 * Auth (SIWE) service tests — fully offline: a message is signed with a viem
 * account and verified via pure signature recovery (no RPC).
 */
import { describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { createSiweMessage } from 'viem/siwe';
import type { AppContext } from '../../src/context.js';
import { loadConfig } from '../../src/config/env.js';
import { ApiError } from '../../src/lib/errors.js';
import { createAuthService } from '../../src/services/auth.js';
import { makeChain, makeDb } from '../routers-kit.js';
import { silentLogger } from '../helpers.js';

const config = loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' });

const makeCtx = (): AppContext => ({
  config,
  logger: silentLogger,
  chain: makeChain(),
  db: makeDb(),
});

const KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const OTHER_KEY =
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cddfe74a';

const buildMessage = (address: `0x${string}`, nonce = 'abcdef1234567890'): string =>
  createSiweMessage({
    address,
    chainId: 84_532,
    domain: 'example.com',
    nonce,
    uri: 'https://example.com',
    version: '1',
  });

describe('AuthService.createNonce', () => {
  it('mints a non-empty nonce with an issue time', () => {
    const { nonce, issuedAt } = createAuthService(makeCtx()).createNonce();
    expect(nonce).toMatch(/^[a-zA-Z0-9]+$/);
    expect(Number.isNaN(Date.parse(issuedAt))).toBe(false);
  });
});

describe('AuthService.verify', () => {
  it('verifies a correctly signed SIWE message', async () => {
    const account = privateKeyToAccount(KEY);
    const message = buildMessage(account.address);
    const signature = await account.signMessage({ message });

    const session = await createAuthService(makeCtx()).verify({ message, signature });
    expect(session.address).toBe(account.address.toLowerCase());
    expect(session.chainId).toBe(84_532);
    expect(session.domain).toBe('example.com');
  });

  it('enforces the expected nonce when provided', async () => {
    const account = privateKeyToAccount(KEY);
    const message = buildMessage(account.address, 'nonceone1111');
    const signature = await account.signMessage({ message });

    await expect(
      createAuthService(makeCtx()).verify({ message, signature, nonce: 'different0000' }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects a signature from a different key (address mismatch)', async () => {
    const account = privateKeyToAccount(KEY);
    const impostor = privateKeyToAccount(OTHER_KEY);
    const message = buildMessage(account.address); // claims `account`
    const signature = await impostor.signMessage({ message }); // signed by impostor

    await expect(
      createAuthService(makeCtx()).verify({ message, signature }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects a malformed signature', async () => {
    const account = privateKeyToAccount(KEY);
    const message = buildMessage(account.address);
    await expect(
      createAuthService(makeCtx()).verify({
        message,
        signature: 'not-hex' as `0x${string}`,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
