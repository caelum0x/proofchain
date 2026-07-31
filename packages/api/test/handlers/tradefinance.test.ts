import { describe, expect, it } from 'vitest';
import tradefinance from '../../src/indexer/handlers/tradefinance.js';
import { makeDeps, makeEvent } from './kit.js';

const LC = ('0x' + 'aa'.repeat(32)) as `0x${string}`;
const APPLICANT = '0x00000000000000000000000000000000000000A1';
const BENEFICIARY = '0x00000000000000000000000000000000000000B2';
const TOKEN = '0x00000000000000000000000000000000000000C3';

describe('tradefinance handler', () => {
  it('declares its owned contracts and group', () => {
    expect(tradefinance.group).toBe('tradefinance');
    expect(tradefinance.contracts).toContain('LetterOfCredit');
    expect(tradefinance.contracts).toContain('GuaranteeRegistry');
  });

  it('always writes the audit table and projects an Issued LC row', async () => {
    const { db, deps } = makeDeps();
    await tradefinance.handle(
      makeEvent({
        contract: 'LetterOfCredit',
        eventName: 'Issued',
        args: {
          lcId: LC,
          applicant: APPLICANT,
          beneficiary: BENEFICIARY,
          token: TOKEN,
          amount: '250000',
          expiry: '1893456000',
        },
      }),
      deps,
    );

    const tables = db.upserts.map((u) => u.table);
    expect(tables).toContain('indexer_events');
    const lc = db.upserts.find((u) => u.table === 'letters_of_credit');
    expect(lc?.row.id).toBe(LC.toLowerCase());
    expect(lc?.row.applicant).toBe(APPLICANT.toLowerCase());
    expect(lc?.row.beneficiary).toBe(BENEFICIARY.toLowerCase());
    expect(lc?.row.amount).toBe('250000');
    expect(lc?.row.status).toBe('issued');
    expect(lc?.row.expiry_date).toBe(new Date(1893456000 * 1000).toISOString());
  });

  it('transitions an existing LC to paid, preserving columns', async () => {
    const { db, deps } = makeDeps();
    db.seed('letters_of_credit', LC.toLowerCase(), {
      id: LC.toLowerCase(),
      applicant: APPLICANT.toLowerCase(),
      beneficiary: BENEFICIARY.toLowerCase(),
      amount: '250000',
      status: 'issued',
    });
    await tradefinance.handle(
      makeEvent({
        contract: 'LetterOfCredit',
        eventName: 'Paid',
        args: { lcId: LC, beneficiary: BENEFICIARY, amount: '250000' },
      }),
      deps,
    );
    const lc = db.upserts.find((u) => u.table === 'letters_of_credit');
    expect(lc?.row.status).toBe('paid');
    expect(lc?.row.applicant).toBe(APPLICANT.toLowerCase());
  });

  it('is audit-only for a transition on an unknown LC', async () => {
    const { db, deps } = makeDeps();
    await tradefinance.handle(
      makeEvent({
        contract: 'LetterOfCredit',
        eventName: 'Paid',
        args: { lcId: LC, beneficiary: BENEFICIARY, amount: '1' },
      }),
      deps,
    );
    expect(db.upserts.some((u) => u.table === 'letters_of_credit')).toBe(false);
    expect(db.upserts.some((u) => u.table === 'indexer_events')).toBe(true);
  });

  it('is audit-only for a non-LC trade-finance contract', async () => {
    const { db, deps } = makeDeps();
    await tradefinance.handle(
      makeEvent({
        contract: 'FactoringAgreement',
        eventName: 'Offered',
        args: { agreementId: LC, seller: APPLICANT },
      }),
      deps,
    );
    expect(db.upserts.every((u) => u.table === 'indexer_events')).toBe(true);
  });

  it('skips projection (audit-only) when Supabase is unconfigured', async () => {
    const { db, deps } = makeDeps(false);
    await tradefinance.handle(
      makeEvent({
        contract: 'LetterOfCredit',
        eventName: 'Issued',
        args: { lcId: LC, applicant: APPLICANT, beneficiary: BENEFICIARY, amount: '1' },
      }),
      deps,
    );
    expect(db.upserts).toHaveLength(0);
  });
});
