import { describe, expect, it } from 'vitest';
import dpp from '../../src/indexer/handlers/dpp.js';
import { makeDeps, makeEvent } from './kit.js';

const BATCH = ('0x' + '11'.repeat(32)) as `0x${string}`;
const MFR = '0x00000000000000000000000000000000000000F6';
const GTIN = ('0x' + '00'.repeat(28) + '01020304') as `0x${string}`;

describe('dpp handler', () => {
  it('declares its owned contracts and group', () => {
    expect(dpp.group).toBe('dpp');
    expect(dpp.contracts).toContain('DigitalProductPassport');
    expect(dpp.contracts).toContain('DPPComplianceOracle');
  });

  it('projects a PassportIssued into passports (status=issued)', async () => {
    const { db, deps } = makeDeps();
    await dpp.handle(
      makeEvent({
        contract: 'DigitalProductPassport',
        eventName: 'PassportIssued',
        args: { tokenId: '7', batchId: BATCH, manufacturer: MFR, gtin: GTIN },
      }),
      deps,
    );
    const row = db.upserts.find((u) => u.table === 'passports');
    expect(row?.row.token_id).toBe('7');
    expect(row?.row.owner).toBe(MFR.toLowerCase());
    expect(row?.row.batch_id).toBe(BATCH.toLowerCase());
    expect(row?.row.status).toBe('issued');
    expect((row?.row.metadata as Record<string, unknown>).gtin).toBe(GTIN);
  });

  it('transitions to retired on StatusChanged=Retired(4)', async () => {
    const { db, deps } = makeDeps();
    db.seed('passports', '7', { token_id: '7', owner: MFR.toLowerCase(), status: 'issued' });
    await dpp.handle(
      makeEvent({
        contract: 'DigitalProductPassport',
        eventName: 'StatusChanged',
        args: { tokenId: '7', status: 4 },
      }),
      deps,
    );
    const row = db.upserts.find((u) => u.table === 'passports');
    expect(row?.row.status).toBe('retired');
    expect(row?.row.owner).toBe(MFR.toLowerCase());
  });

  it('leaves the row untouched for a status not representable in the read model', async () => {
    const { db, deps } = makeDeps();
    db.seed('passports', '7', { token_id: '7', status: 'issued' });
    await dpp.handle(
      makeEvent({
        contract: 'DigitalProductPassport',
        eventName: 'StatusChanged',
        args: { tokenId: '7', status: 2 }, // Suspended — no read-model equivalent
      }),
      deps,
    );
    expect(db.upserts.some((u) => u.table === 'passports')).toBe(false);
  });
});
