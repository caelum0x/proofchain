import { describe, expect, it } from 'vitest';
import logistics from '../../src/indexer/handlers/logistics.js';
import { makeDeps, makeEvent } from './kit.js';

const BOOKING = ('0x' + 'bb'.repeat(32)) as `0x${string}`;
const BATCH = ('0x' + '11'.repeat(32)) as `0x${string}`;
const SHIPPER = '0x0000000000000000000000000000000000000A11';
const CARRIER = '0x0000000000000000000000000000000000000B22';

describe('logistics handler', () => {
  it('declares its owned contracts and group', () => {
    expect(logistics.group).toBe('logistics');
    expect(logistics.contracts).toContain('FreightBooking');
    expect(logistics.contracts).toContain('LastMileProofOfDelivery');
  });

  it('projects a Requested booking into freight (status=booked)', async () => {
    const { db, deps } = makeDeps();
    await logistics.handle(
      makeEvent({
        contract: 'FreightBooking',
        eventName: 'Requested',
        args: { bookingId: BOOKING, batchId: BATCH, shipper: SHIPPER, carrier: CARRIER, mode: 2 },
      }),
      deps,
    );
    const row = db.upserts.find((u) => u.table === 'freight');
    expect(row?.row.id).toBe(BOOKING.toLowerCase());
    expect(row?.row.shipper).toBe(SHIPPER.toLowerCase());
    expect(row?.row.carrier).toBe(CARRIER.toLowerCase());
    expect(row?.row.status).toBe('booked');
    expect((row?.row.metadata as Record<string, unknown>).mode).toBe(2);
  });

  it('attaches the ETA on Confirmed for an existing booking', async () => {
    const { db, deps } = makeDeps();
    db.seed('freight', BOOKING.toLowerCase(), {
      id: BOOKING.toLowerCase(),
      shipper: SHIPPER.toLowerCase(),
      status: 'booked',
      eta: null,
    });
    await logistics.handle(
      makeEvent({
        contract: 'FreightBooking',
        eventName: 'Confirmed',
        args: { bookingId: BOOKING, freightAmount: '100', etd: '1893456000', eta: '1893542400' },
      }),
      deps,
    );
    const row = db.upserts.find((u) => u.table === 'freight');
    expect(row?.row.eta).toBe(new Date(1893542400 * 1000).toISOString());
    expect(row?.row.shipper).toBe(SHIPPER.toLowerCase());
  });
});
