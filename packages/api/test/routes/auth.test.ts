/**
 * /auth route tests — nonce minting + SIWE verification over HTTP (offline).
 */
import { describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { createSiweMessage } from 'viem/siwe';
import authPlugin from '../../src/routes/auth.js';
import { buildApp } from '../routers-kit.js';

const KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

describe('auth router', () => {
  it('mints a nonce', async () => {
    const app = await buildApp(authPlugin);
    const res = await app.inject({ method: 'POST', url: '/auth/nonce' });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json().data.nonce).toBe('string');
    await app.close();
  });

  it('verifies a signed SIWE message', async () => {
    const account = privateKeyToAccount(KEY);
    const message = createSiweMessage({
      address: account.address,
      chainId: 84_532,
      domain: 'example.com',
      nonce: 'abcdef1234567890',
      uri: 'https://example.com',
      version: '1',
    });
    const signature = await account.signMessage({ message });

    const app = await buildApp(authPlugin);
    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: { message, signature },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.address).toBe(account.address.toLowerCase());
    await app.close();
  });

  it('400s a verify with a missing signature', async () => {
    const app = await buildApp(authPlugin);
    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: { message: 'x' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });
});
