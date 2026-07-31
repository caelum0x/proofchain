import { describe, expect, it } from 'vitest';
import workforce from '../../src/indexer/handlers/workforce.js';
import { makeDeps, makeEvent } from './kit.js';

const AGREEMENT = ('0x' + 'ee'.repeat(32)) as `0x${string}`;
const ROLE = ('0x' + '00'.repeat(30) + '1234') as `0x${string}`;
const WORKER = '0x0000000000000000000000000000000000000E55';
const EMPLOYER = '0x0000000000000000000000000000000000000F66';
const TOKEN = '0x00000000000000000000000000000000000000C7';
const ISSUER = '0x00000000000000000000000000000000000000A8';

describe('workforce handler', () => {
  it('declares its owned contracts and group', () => {
    expect(workforce.group).toBe('workforce');
    expect(workforce.contracts).toContain('WorkerCredential');
    expect(workforce.contracts).toContain('MilestonePayroll');
  });

  it('projects a CredentialIssued into worker_credentials (status=active)', async () => {
    const { db, deps } = makeDeps();
    await workforce.handle(
      makeEvent({
        contract: 'WorkerCredential',
        eventName: 'CredentialIssued',
        args: { tokenId: '3', worker: WORKER, issuer: ISSUER, role: ROLE },
      }),
      deps,
    );
    const row = db.upserts.find((u) => u.table === 'worker_credentials');
    expect(row?.row.id).toBe('3');
    expect(row?.row.worker).toBe(WORKER.toLowerCase());
    expect(row?.row.issuer).toBe(ISSUER.toLowerCase());
    expect(row?.row.status).toBe('active');
  });

  it('transitions a credential to revoked on CredentialStatusChanged=Revoked(3)', async () => {
    const { db, deps } = makeDeps();
    db.seed('worker_credentials', '3', { id: '3', worker: WORKER.toLowerCase(), status: 'active' });
    await workforce.handle(
      makeEvent({
        contract: 'WorkerCredential',
        eventName: 'CredentialStatusChanged',
        args: { tokenId: '3', status: 3 },
      }),
      deps,
    );
    const row = db.upserts.find((u) => u.table === 'worker_credentials');
    expect(row?.row.status).toBe('revoked');
  });

  it('projects an AgreementCreated into payroll (status=pending)', async () => {
    const { db, deps } = makeDeps();
    await workforce.handle(
      makeEvent({
        contract: 'MilestonePayroll',
        eventName: 'AgreementCreated',
        args: { agreementId: AGREEMENT, employer: EMPLOYER, worker: WORKER, token: TOKEN, totalAmount: '9000' },
      }),
      deps,
    );
    const row = db.upserts.find((u) => u.table === 'payroll');
    expect(row?.row.id).toBe(AGREEMENT.toLowerCase());
    expect(row?.row.worker).toBe(WORKER.toLowerCase());
    expect(row?.row.amount).toBe('9000');
    expect(row?.row.status).toBe('pending');
  });

  it('transitions payroll to paid on MilestoneReleased', async () => {
    const { db, deps } = makeDeps();
    db.seed('payroll', AGREEMENT.toLowerCase(), {
      id: AGREEMENT.toLowerCase(),
      worker: WORKER.toLowerCase(),
      amount: '9000',
      status: 'pending',
    });
    await workforce.handle(
      makeEvent({
        contract: 'MilestonePayroll',
        eventName: 'MilestoneReleased',
        args: { agreementId: AGREEMENT, index: 0, worker: WORKER, amount: '3000' },
      }),
      deps,
    );
    const row = db.upserts.find((u) => u.table === 'payroll');
    expect(row?.row.status).toBe('paid');
    expect(row?.row.amount).toBe('9000');
  });
});
