/**
 * Analytics service tests — per-domain aggregations over an in-memory read
 * model (projection tables + the indexer_events audit log).
 */
import { describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/context.js';
import { loadConfig } from '../../src/config/env.js';
import { createAnalyticsService } from '../../src/services/analytics.js';
import { makeChain, makeDb, type Row } from '../routers-kit.js';
import { silentLogger } from '../helpers.js';

const config = loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' });

const makeCtx = (data: Record<string, readonly Row[]>): AppContext => ({
  config,
  logger: silentLogger,
  chain: makeChain(),
  db: makeDb(data),
});

describe('AnalyticsService.finance', () => {
  it('aggregates finance projection counts + event count', async () => {
    const svc = createAnalyticsService(
      makeCtx({
        financing_listings: [{ id: 'l1' }, { id: 'l2' }],
        receivables: [{ id: 'r1' }],
        pools: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
        indexer_events: [
          { id: 'e1', group_name: 'finance' },
          { id: 'e2', group_name: 'insurance' },
        ],
      }),
    );
    const result = await svc.finance();
    expect(result.domain).toBe('finance');
    expect(result.events).toBe(1);
    expect(result.metrics).toEqual({ listings: 2, receivables: 1, pools: 3 });
  });
});

describe('AnalyticsService.settlement', () => {
  it('breaks deals down by state', async () => {
    const svc = createAnalyticsService(
      makeCtx({
        deals: [
          { id: 'd1', state: 'funded' },
          { id: 'd2', state: 'released' },
          { id: 'd3', state: 'released' },
          { id: 'd4', state: 'disputed' },
        ],
        indexer_events: [{ id: 'e1', group_name: 'settlement' }],
      }),
    );
    const result = await svc.settlement();
    expect(result.metrics).toEqual({
      funded: 1,
      released: 2,
      refunded: 0,
      disputed: 1,
    });
    expect(result.events).toBe(1);
  });
});

describe('AnalyticsService.reputation', () => {
  it('returns event counts with no projection metrics', async () => {
    const svc = createAnalyticsService(
      makeCtx({ indexer_events: [{ id: 'e1', group_name: 'reputation' }] }),
    );
    const result = await svc.reputation();
    expect(result).toEqual({ domain: 'reputation', events: 1, metrics: {} });
  });
});
