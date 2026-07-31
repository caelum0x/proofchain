import { describe, expect, it } from 'vitest';
import compliance from '../../src/indexer/handlers/compliance.js';
import { makeDeps, makeEvent } from './kit.js';

const CERT = ('0x' + 'cc'.repeat(32)) as `0x${string}`;
const BATCH = ('0x' + '11'.repeat(32)) as `0x${string}`;
const ISSUER = '0x00000000000000000000000000000000000000D4';
const CERTIFIER = '0x00000000000000000000000000000000000000E5';

describe('compliance handler', () => {
  it('declares its owned contracts and group', () => {
    expect(compliance.group).toBe('compliance');
    expect(compliance.contracts).toContain('SanctionsScreening');
    expect(compliance.contracts).toContain('CustomsDeclaration');
  });

  it('projects a CertificateOfOrigin Issued into certificates (kind=origin)', async () => {
    const { db, deps } = makeDeps();
    await compliance.handle(
      makeEvent({
        contract: 'CertificateOfOrigin',
        eventName: 'Issued',
        args: {
          certId: CERT,
          batchId: BATCH,
          originCountry: ('0x' + '00'.repeat(31) + '2a') as `0x${string}`,
          originType: 1,
          issuer: ISSUER,
          expiry: '1893456000',
        },
      }),
      deps,
    );
    const cert = db.upserts.find((u) => u.table === 'certificates');
    expect(cert?.row.id).toBe(CERT.toLowerCase());
    expect(cert?.row.kind).toBe('origin');
    expect(cert?.row.batch_id).toBe(BATCH.toLowerCase());
    expect(cert?.row.issuer).toBe(ISSUER.toLowerCase());
    expect(cert?.row.status).toBe('valid');
    expect((cert?.row.metadata as Record<string, unknown>).originType).toBe(1);
  });

  it('maps HalalCertification.certifier to the issuer column (kind=halal)', async () => {
    const { db, deps } = makeDeps();
    await compliance.handle(
      makeEvent({
        contract: 'HalalCertification',
        eventName: 'Issued',
        args: { certId: CERT, batchId: BATCH, certifier: CERTIFIER, expiry: '0' },
      }),
      deps,
    );
    const cert = db.upserts.find((u) => u.table === 'certificates');
    expect(cert?.row.kind).toBe('halal');
    expect(cert?.row.issuer).toBe(CERTIFIER.toLowerCase());
    expect(cert?.row.expires_at).toBeNull(); // 0 sentinel → null
  });

  it('is audit-only for non-certificate compliance events', async () => {
    const { db, deps } = makeDeps();
    await compliance.handle(
      makeEvent({
        contract: 'SanctionsScreening',
        eventName: 'AddressListed',
        args: { account: ISSUER, source: 0, reasonHash: BATCH },
      }),
      deps,
    );
    expect(db.upserts.every((u) => u.table === 'indexer_events')).toBe(true);
  });
});
