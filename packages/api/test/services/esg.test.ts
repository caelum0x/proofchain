import { describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/context.js';
import { loadConfig } from '../../src/config/env.js';
import { createEsgService } from '../../src/services/esg.js';
import { makeChain, makeDb, type Row } from '../routers-kit.js';
import { silentLogger } from '../helpers.js';

const config = loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' });

const seed: Row[] = [
  { subject: 'org-a', score: 82, rating: 'A', uri: 'ipfs://a', created_at: '2026-01-03' },
  { subject: 'org-a', score: 70, rating: 'B', uri: 'ipfs://old', created_at: '2026-01-01' },
  { subject: 'org-b', score: 40, rating: 'C', uri: 'ipfs://b', created_at: '2026-01-02' },
];

const makeCtx = (parts: Partial<Pick<AppContext, 'db' | 'chain'>> = {}): AppContext => ({
  config,
  logger: silentLogger,
  chain: parts.chain ?? makeChain(),
  db: parts.db ?? makeDb(),
});

const page = { limit: 25, offset: 0 };

describe('EsgService', () => {
  it('lists records and applies a minimum-score filter', async () => {
    const svc = createEsgService(makeCtx({ db: makeDb({ esg: seed }) }));
    expect((await svc.list({ pagination: page })).total).toBe(3);
    const strong = await svc.list({ pagination: page, minScore: 60 });
    expect(strong.total).toBe(2);
    expect(strong.rows.every((r) => (r.score ?? 0) >= 60)).toBe(true);
  });

  it('returns the LATEST record for a subject (DB-first)', async () => {
    const svc = createEsgService(makeCtx({ db: makeDb({ esg: seed }) }));
    const detail = await svc.getBySubject('org-a');
    expect(detail).toMatchObject({ score: 82, rating: 'A', source: 'db' });
  });

  it('falls back to on-chain scoreOf', async () => {
    const chain = makeChain({
      contracts: { ESGRegistry: true },
      reads: { scoreOf: { score: 55n, rating: 'B', uri: 'ipfs://x', updatedAt: 1n, exists: true } },
    });
    const svc = createEsgService(makeCtx({ db: makeDb({}), chain }));
    expect(await svc.getBySubject('org-z')).toMatchObject({ score: 55, source: 'chain' });
  });

  it('returns null when unknown', async () => {
    const svc = createEsgService(makeCtx({ db: makeDb({}) }));
    expect(await svc.getBySubject('org-z')).toBeNull();
  });
});
