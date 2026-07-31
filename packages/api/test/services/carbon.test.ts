import { describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/context.js';
import { loadConfig } from '../../src/config/env.js';
import { createCarbonService } from '../../src/services/carbon.js';
import { makeChain, makeDb, type Row } from '../routers-kit.js';
import { silentLogger } from '../helpers.js';

const config = loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' });

const seed: Row[] = [
  { id: 'k1', project_id: 'proj-a', batch_id: null, emitted: '100', retired: '30', created_at: '2026-01-03' },
  { id: 'k2', project_id: 'proj-a', batch_id: null, emitted: '50', retired: '20', created_at: '2026-01-02' },
  { id: 'k3', project_id: 'proj-b', batch_id: null, emitted: '10', retired: '10', created_at: '2026-01-01' },
];

const makeCtx = (parts: Partial<Pick<AppContext, 'db' | 'chain'>> = {}): AppContext => ({
  config,
  logger: silentLogger,
  chain: parts.chain ?? makeChain(),
  db: parts.db ?? makeDb(),
});

const page = { limit: 25, offset: 0 };

describe('CarbonService', () => {
  it('lists and filters by project', async () => {
    const svc = createCarbonService(makeCtx({ db: makeDb({ carbon: seed }) }));
    expect((await svc.list({ pagination: page })).total).toBe(3);
    const projA = await svc.list({ pagination: page, projectId: 'proj-a' });
    expect(projA.total).toBe(2);
  });

  it('resolves a single record by id', async () => {
    const svc = createCarbonService(makeCtx({ db: makeDb({ carbon: seed }) }));
    expect(await svc.getById('k1')).toMatchObject({ id: 'k1', emitted: '100' });
    expect(await svc.getById('nope')).toBeNull();
  });

  it('summarizes net outstanding CO2e across a project', async () => {
    const svc = createCarbonService(makeCtx({ db: makeDb({ carbon: seed }) }));
    const summary = await svc.summarize('proj-a');
    expect(summary).toMatchObject({ emitted: '150', retired: '50', outstanding: '100', records: 2 });
  });
});
