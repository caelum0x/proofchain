import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/http/server.js';
import { loadConfig } from '../src/config/env.js';
import { createInMemoryJobStore } from '../src/jobs/store.js';
import { mockChainClient, silentLogger, SAMPLE_BATCH } from './helpers.js';
import type { Verifier } from '../src/verifier.js';

const config = () =>
  loadConfig({
    ANTHROPIC_API_KEY: 'k',
    AGENT_PRIVATE_KEY: `0x${'1'.repeat(64)}`,
    BASE_SEPOLIA_RPC_URL: 'http://localhost:8545',
    NODE_ENV: 'test',
  });

const verify = vi.fn();
const verifier = { verify } as unknown as Verifier;

const makeApp = (): Promise<FastifyInstance> =>
  buildServer({
    config: config(),
    logger: silentLogger(),
    verifier,
    jobStore: createInMemoryJobStore(),
    chain: mockChainClient(),
  });

let app: FastifyInstance | undefined;
afterEach(async () => {
  verify.mockReset();
  if (app !== undefined) {
    await app.close();
    app = undefined;
  }
});

const post = async (payload: Record<string, unknown>) => {
  app = await makeApp();
  return app.inject({ method: 'POST', url: '/verify', payload });
};

describe('POST /verify validation', () => {
  it('rejects a missing batchId', async () => {
    const res = await post({ documents: [] });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects a malformed batchId', async () => {
    const res = await post({ batchId: '0x123', documents: [] });
    expect(res.statusCode).toBe(400);
  });

  it('rejects an empty documents array', async () => {
    const res = await post({ batchId: SAMPLE_BATCH, documents: [] });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a document lacking both dataBase64 and url', async () => {
    const res = await post({
      batchId: SAMPLE_BATCH,
      documents: [{ name: 'x.pdf', mimeType: 'application/pdf' }],
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a document with an invalid url', async () => {
    const res = await post({
      batchId: SAMPLE_BATCH,
      documents: [{ name: 'x', mimeType: 'text/plain', url: 'not-a-url' }],
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects too many documents', async () => {
    const documents = Array.from({ length: 17 }, (_, i) => ({
      name: `d${i}`,
      mimeType: 'text/plain',
      dataBase64: 'YQ==',
    }));
    const res = await post({ batchId: SAMPLE_BATCH, documents });
    expect(res.statusCode).toBe(400);
  });

  it('returns a structured error envelope (never a raw ZodError)', async () => {
    const res = await post({ batchId: SAMPLE_BATCH, documents: [] });
    const body = res.json();
    expect(body).toMatchObject({
      success: false,
      data: null,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(body.error.details).toBeDefined();
  });
});

describe('GET /jobs/:id validation', () => {
  it('rejects a non-uuid id with 400', async () => {
    app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/jobs/not-a-uuid' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for an unknown (but well-formed) job id', async () => {
    app = await makeApp();
    const res = await app.inject({
      method: 'GET',
      url: '/jobs/11111111-1111-4111-8111-111111111111',
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});

describe('unknown routes', () => {
  it('returns a 404 envelope', async () => {
    app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});
