import { describe, expect, it } from 'vitest';
import kycPlugin from '../src/routes/kyc.js';
import { buildApp, makeChain, makeDb, type Row } from './routers-kit.js';

const A1 = '0x1111111111111111111111111111111111111111';
const A2 = '0x2222222222222222222222222222222222222222';
const PROVIDER = '0x5555555555555555555555555555555555555555';

const kyc: Row[] = [{ address: A1, level: 2, provider: PROVIDER, updated_at: '2026-01-01' }];

describe('GET /kyc/:address', () => {
  it('returns the indexed KYC status (verified derived from level)', async () => {
    const app = await buildApp(kycPlugin, { db: makeDb({ kyc }) });
    const res = await app.inject({ method: 'GET', url: `/kyc/${A1}` });
    expect(res.json().data).toMatchObject({ level: 2, verified: true, source: 'db' });
    await app.close();
  });

  it('reads on-chain kycOf and normalizes the zero provider (source=chain)', async () => {
    const chain = makeChain({
      contracts: { KYCRegistry: true },
      reads: { kycOf: { level: 1, updatedAt: 10n, provider: PROVIDER } },
    });
    const app = await buildApp(kycPlugin, { db: makeDb({}), chain });
    const res = await app.inject({ method: 'GET', url: `/kyc/${A2}` });
    expect(res.json().data).toMatchObject({ level: 1, verified: true, provider: PROVIDER, source: 'chain' });
    await app.close();
  });

  it('reports unknown status (level 0, unverified) when nothing is available', async () => {
    const app = await buildApp(kycPlugin, { db: makeDb({}) });
    const res = await app.inject({ method: 'GET', url: `/kyc/${A2}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ level: 0, verified: false, source: 'unknown' });
    await app.close();
  });
});
