/**
 * Service-layer test convention (mocked chain + db, fully offline).
 *
 * A service is tested WITHOUT HTTP: build an `AppContext` from the in-memory `Db`
 * and stub `ChainReader` doubles, construct the service factory, and assert on
 * the typed DTOs it returns. This is the pattern Fill agents follow for every
 * `src/services/<domain>.ts`.
 */
import { describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/context.js';
import { loadConfig } from '../../src/config/env.js';
import { createSuppliersService } from '../../src/services/suppliers.js';
import { makeChain, makeDb, type Row } from '../routers-kit.js';
import { silentLogger } from '../helpers.js';

const A1 = '0x1111111111111111111111111111111111111111';
const A2 = '0x2222222222222222222222222222222222222222';

const config = loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' });

const seedRows: Row[] = [
  { address: A1, name: 'Acme Steel', uri: 'ipfs://a', org_id: 'org1', created_at: '2026-01-02' },
  { address: A2, name: 'Beta Foods', uri: 'ipfs://b', org_id: 'org2', created_at: '2026-01-01' },
];

const makeCtx = (parts: Partial<Pick<AppContext, 'db' | 'chain'>> = {}): AppContext => ({
  config,
  logger: silentLogger,
  chain: parts.chain ?? makeChain(),
  db: parts.db ?? makeDb(),
});

const page = { limit: 25, offset: 0 };

describe('SuppliersService.list', () => {
  it('returns the indexed rows with a total, newest-first', async () => {
    const svc = createSuppliersService(makeCtx({ db: makeDb({ suppliers: seedRows }) }));
    const { rows, total } = await svc.list({ pagination: page });
    expect(total).toBe(2);
    expect(rows[0]?.address).toBe(A1); // created_at desc
  });

  it('scopes the list to an organization', async () => {
    const svc = createSuppliersService(makeCtx({ db: makeDb({ suppliers: seedRows }) }));
    const { rows, total } = await svc.list({ pagination: page, orgId: 'org2' });
    expect(total).toBe(1);
    expect(rows[0]?.address).toBe(A2);
  });
});

describe('SuppliersService.search', () => {
  it('matches on a case-insensitive name substring', async () => {
    const svc = createSuppliersService(makeCtx({ db: makeDb({ suppliers: seedRows }) }));
    const { rows, total } = await svc.search({ pagination: page, q: 'steel' });
    expect(total).toBe(1);
    expect(rows[0]?.name).toBe('Acme Steel');
  });
});

describe('SuppliersService.getByAddress', () => {
  it('returns the indexed row with source=db', async () => {
    const svc = createSuppliersService(makeCtx({ db: makeDb({ suppliers: seedRows }) }));
    const detail = await svc.getByAddress(A1);
    expect(detail).toMatchObject({ name: 'Acme Steel', source: 'db' });
  });

  it('falls back to an on-chain profileOf read (source=chain)', async () => {
    const chain = makeChain({
      contracts: { SupplierRegistry: true },
      reads: {
        profileOf: { account: A2, name: 'OnChain Co', uri: 'ipfs://x', registeredAt: 5n, exists: true },
      },
    });
    const svc = createSuppliersService(makeCtx({ db: makeDb({}), chain }));
    const detail = await svc.getByAddress(A2);
    expect(detail).toMatchObject({ name: 'OnChain Co', source: 'chain' });
  });

  it('returns null when neither the DB nor a deployed contract knows the address', async () => {
    const svc = createSuppliersService(makeCtx({ db: makeDb({}) }));
    expect(await svc.getByAddress(A2)).toBeNull();
  });
});
