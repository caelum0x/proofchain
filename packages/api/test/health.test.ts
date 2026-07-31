import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import healthPlugin from '../src/routes/health.js';
import type { AppContext } from '../src/context.js';
import type { ChainReader } from '../src/lib/chain.js';
import { createFakeDb, silentLogger } from './helpers.js';
import { loadConfig } from '../src/config/env.js';

const config = loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' });

const buildChain = (opts: { block?: bigint; throws?: boolean }): ChainReader =>
  ({
    chainId: 84_532,
    client: {} as never,
    async getBlockNumber() {
      if (opts.throws) throw new Error('rpc down');
      return opts.block ?? 123n;
    },
    async getLogs() {
      return [];
    },
    addressOf: () => undefined,
    abiOf: () => undefined,
    sources: () => [{ name: 'SettlementEscrow' as never, address: '0x00', abi: [] }],
  }) as unknown as ChainReader;

const buildApp = async (chain: ChainReader, dbConfigured: boolean) => {
  const ctx: AppContext = {
    config,
    logger: silentLogger,
    chain,
    db: createFakeDb(dbConfigured),
  };
  const app = Fastify();
  app.decorate('appContext', ctx);
  await app.register(healthPlugin);
  await app.ready();
  return app;
};

describe('GET /health', () => {
  it('returns 200 and ok status when the chain is reachable', async () => {
    const app = await buildApp(buildChain({ block: 500n }), true);
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
    expect(body.data.chainId).toBe(84_532);
    expect(body.data.checks.chain).toBe(true);
    expect(body.data.checks.db).toBe(true);
    expect(body.data.checks.blockNumber).toBe('500');
    await app.close();
  });

  it('returns 503 and degraded status when the RPC is down', async () => {
    const app = await buildApp(buildChain({ throws: true }), false);
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.data.status).toBe('degraded');
    expect(body.data.checks.chain).toBe(false);
    expect(body.data.checks.db).toBe(false);
    expect(body.data.checks.chainError).toBe('rpc down');
    await app.close();
  });
});
