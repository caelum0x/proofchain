import { describe, expect, it } from 'vitest';
import energy from '../../src/indexer/handlers/energy.js';
import { makeDeps, makeEvent } from './kit.js';

const CONTRACT_ADDR = '0x00000000000000000000000000000000000000Ec';
const FACILITY = ('0x' + '00'.repeat(31) + '05') as `0x${string}`;
const ACCOUNT = '0x0000000000000000000000000000000000000D44';

describe('energy handler', () => {
  it('declares its owned contracts and group', () => {
    expect(energy.group).toBe('energy');
    expect(energy.contracts).toContain('RenewableEnergyCertificate');
    expect(energy.contracts).toContain('GreenBondIssuer');
  });

  it('projects a CertificateIssued into renewable_certificates', async () => {
    const { db, deps } = makeDeps();
    await energy.handle(
      makeEvent({
        contract: 'RenewableEnergyCertificate',
        eventName: 'CertificateIssued',
        address: CONTRACT_ADDR,
        args: { tokenId: '9', facilityId: FACILITY, source: 1, vintageYear: 2024, mwh: '1500' },
      }),
      deps,
    );
    const row = db.upserts.find((u) => u.table === 'renewable_certificates');
    expect(row?.row.id).toBe('9');
    expect(row?.row.token_id).toBe('9');
    expect(row?.row.mwh).toBe('1500');
    expect(row?.row.energy_source).toBe('wind'); // EnergySource.Wind → 'wind'
    expect(row?.row.vintage_year).toBe(2024);
    expect(row?.row.issuer).toBe(CONTRACT_ADDR.toLowerCase());
    expect(row?.row.status).toBe('issued');
  });

  it('falls back to solar for an unknown energy source', async () => {
    const { db, deps } = makeDeps();
    await energy.handle(
      makeEvent({
        contract: 'RenewableEnergyCertificate',
        eventName: 'CertificateIssued',
        args: { tokenId: '10', facilityId: FACILITY, source: 99, mwh: '1' },
      }),
      deps,
    );
    const row = db.upserts.find((u) => u.table === 'renewable_certificates');
    expect(row?.row.energy_source).toBe('solar');
  });

  it('transitions to retired and records the retiring account', async () => {
    const { db, deps } = makeDeps();
    db.seed('renewable_certificates', '9', { id: '9', mwh: '1500', status: 'issued', owner: null });
    await energy.handle(
      makeEvent({
        contract: 'RenewableEnergyCertificate',
        eventName: 'CertificateRetired',
        args: { account: ACCOUNT, tokenId: '9', mwh: '1500', beneficiary: FACILITY },
      }),
      deps,
    );
    const row = db.upserts.find((u) => u.table === 'renewable_certificates');
    expect(row?.row.status).toBe('retired');
    expect(row?.row.owner).toBe(ACCOUNT.toLowerCase());
  });
});
