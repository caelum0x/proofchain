import { describe, expect, it } from 'vitest';
import commodities from '../../src/indexer/handlers/commodities.js';
import { makeDeps, makeEvent } from './kit.js';

const HARVEST = ('0x' + 'dd'.repeat(32)) as `0x${string}`;
const PRODUCER = '0x0000000000000000000000000000000000000C33';
const CROP = ('0x' + '00'.repeat(30) + 'beef') as `0x${string}`;
const SEASON = ('0x' + '00'.repeat(30) + '07e6') as `0x${string}`;
const SYMBOL = ('0x' + '00'.repeat(29) + '574845') as `0x${string}`;
const TX = ('0x' + '99'.repeat(32)) as `0x${string}`;

describe('commodities handler', () => {
  it('declares its owned contracts and group', () => {
    expect(commodities.group).toBe('commodities');
    expect(commodities.contracts).toContain('CommodityToken');
    expect(commodities.contracts).toContain('PriceOracle');
  });

  it('projects a HarvestRegistered into harvests (status=recorded)', async () => {
    const { db, deps } = makeDeps();
    await commodities.handle(
      makeEvent({
        contract: 'HarvestRegistry',
        eventName: 'HarvestRegistered',
        args: { harvestId: HARVEST, producer: PRODUCER, crop: CROP, quantityKg: '42000', season: SEASON },
      }),
      deps,
    );
    const row = db.upserts.find((u) => u.table === 'harvests');
    expect(row?.row.id).toBe(HARVEST.toLowerCase());
    expect(row?.row.farmer).toBe(PRODUCER.toLowerCase());
    expect(row?.row.yield_kg).toBe('42000');
    expect(row?.row.status).toBe('recorded');
    expect((row?.row.metadata as Record<string, unknown>).season).toBe(SEASON);
  });

  it('projects a PriceUpdated into commodity_prices keyed by tx:logIndex', async () => {
    const { db, deps } = makeDeps();
    await commodities.handle(
      makeEvent({
        contract: 'PriceOracle',
        eventName: 'PriceUpdated',
        args: { symbol: SYMBOL, price: '31337', updatedAt: '1893456000' },
        transactionHash: TX,
        logIndex: 3,
      }),
      deps,
    );
    const row = db.upserts.find((u) => u.table === 'commodity_prices');
    expect(row?.row.id).toBe(`${TX.toLowerCase()}:3`);
    expect(row?.row.price).toBe('31337');
    expect(row?.row.symbol).toBe(SYMBOL);
    expect(row?.row.observed_at).toBe(new Date(1893456000 * 1000).toISOString());
  });

  it('is audit-only for other commodities contracts', async () => {
    const { db, deps } = makeDeps();
    await commodities.handle(
      makeEvent({
        contract: 'CommodityToken',
        eventName: 'Minted',
        args: { to: PRODUCER, amount: '1', receiptId: HARVEST },
      }),
      deps,
    );
    expect(db.upserts.every((u) => u.table === 'indexer_events')).toBe(true);
  });
});
