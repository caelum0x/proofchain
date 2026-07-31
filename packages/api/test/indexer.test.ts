import { describe, expect, it } from 'vitest';
import {
  encodeAbiParameters,
  encodeEventTopics,
  type AbiParameter,
  type Log,
} from 'viem';
// Resolves to test/doubles/shared.ts via the vitest alias.
import { ABIS } from '@proofchain/shared';
import type { ChainReader, ContractSource } from '../src/lib/chain.js';
import {
  createCursorStore,
  createIndexerEngine,
  decodeLog,
  jsonSafe,
} from '../src/indexer/indexer.js';
import { createFakeDb, silentLogger } from './helpers.js';

const ESCROW_ADDR = '0x00000000000000000000000000000000000000e5' as const;
const BATCH = ('0x' + '11'.repeat(32)) as `0x${string}`;
const BUYER = '0x00000000000000000000000000000000000000b1' as const;
const SUPPLIER = '0x00000000000000000000000000000000000000a1' as const;
const TOKEN = '0x0000000000000000000000000000000000000c01' as const;
const TX = ('0x' + '22'.repeat(32)) as `0x${string}`;

const source: ContractSource = {
  name: 'SettlementEscrow' as never,
  address: ESCROW_ADDR,
  abi: ABIS.SettlementEscrow,
};

// viem exposes `encodeEventTopics` (indexed params + signature) and
// `encodeAbiParameters` (non-indexed data) rather than a single
// `encodeEventLog`, so we compose them to build a raw log the decoder can read.
const encodeLog = (
  eventName: 'Funded' | 'Released',
  args: Record<string, unknown>,
): { data: `0x${string}`; topics: [`0x${string}`, ...`0x${string}`[]] } => {
  const topics = encodeEventTopics({
    abi: ABIS.SettlementEscrow,
    eventName,
    args: args as never,
  }) as [`0x${string}`, ...`0x${string}`[]];
  const event = ABIS.SettlementEscrow.find(
    (e): e is Extract<typeof e, { type: 'event' }> =>
      e.type === 'event' && e.name === eventName,
  );
  const nonIndexed = (event?.inputs ?? []).filter((i) => !i.indexed);
  const data = encodeAbiParameters(
    nonIndexed as unknown as AbiParameter[],
    nonIndexed.map((i) => args[i.name as string]) as never,
  );
  return { data, topics };
};

const buildLog = (
  eventName: 'Funded' | 'Released',
  args: Record<string, unknown>,
  logIndex = 0,
): Log => {
  const { data, topics } = encodeLog(eventName, args);
  return {
    address: ESCROW_ADDR,
    data,
    topics,
    blockNumber: 100n,
    transactionHash: TX,
    logIndex,
    transactionIndex: 0,
    blockHash: ('0x' + '33'.repeat(32)) as `0x${string}`,
    removed: false,
  } as Log;
};

const fakeChain = (logs: Log[]): ChainReader =>
  ({
    chainId: 84_532,
    client: {} as never,
    async getBlockNumber() {
      return 100n;
    },
    async getLogs() {
      return logs;
    },
    addressOf: () => ESCROW_ADDR,
    abiOf: () => ABIS.SettlementEscrow,
    sources: () => [source],
  }) as unknown as ChainReader;

describe('jsonSafe', () => {
  it('converts bigints to strings recursively', () => {
    expect(jsonSafe({ a: 1n, b: [2n, { c: 3n }] })).toEqual({
      a: '1',
      b: ['2', { c: '3' }],
    });
  });
});

describe('decodeLog', () => {
  it('decodes a matching event into a DecodedEvent routed to its group', () => {
    const log = buildLog('Funded', {
      batchId: BATCH,
      buyer: BUYER,
      supplier: SUPPLIER,
      token: TOKEN,
      amount: 1000n,
    });
    const event = decodeLog(source, log);
    expect(event).not.toBeNull();
    expect(event?.group).toBe('settlement');
    expect(event?.eventName).toBe('Funded');
    expect(event?.args.amount).toBe('1000'); // bigint → string
    expect(event?.blockNumber).toBe(100n);
  });

  it('returns null for a pending log (no block position)', () => {
    const log = buildLog('Funded', {
      batchId: BATCH,
      buyer: BUYER,
      supplier: SUPPLIER,
      token: TOKEN,
      amount: 1n,
    });
    const pending = { ...log, blockNumber: null, transactionHash: null, logIndex: null } as Log;
    expect(decodeLog(source, pending)).toBeNull();
  });
});

describe('indexer engine — settlement projection', () => {
  it('persists the event and projects a Funded deal row', async () => {
    const db = createFakeDb(true);
    const log = buildLog('Funded', {
      batchId: BATCH,
      buyer: BUYER,
      supplier: SUPPLIER,
      token: TOKEN,
      amount: 5000n,
    });
    const engine = createIndexerEngine({
      chain: fakeChain([log]),
      db,
      logger: silentLogger,
    });
    const count = await engine.processRange({ ...source }, 100n, 100n);
    expect(count).toBe(1);

    const tables = db.upserts.map((u) => u.table);
    expect(tables).toContain('indexer_events');
    expect(tables).toContain('deals');

    const deal = db.upserts.find((u) => u.table === 'deals');
    expect(deal?.row.state).toBe('funded');
    expect(deal?.row.batch_id).toBe(BATCH.toLowerCase());
    expect(deal?.row.amount).toBe('5000');
  });

  it('merges a transition event onto an existing deal', async () => {
    const db = createFakeDb(true);
    db.seed('deals', BATCH.toLowerCase(), {
      batch_id: BATCH.toLowerCase(),
      buyer: BUYER,
      supplier: SUPPLIER,
      token: TOKEN,
      amount: '5000',
      state: 'funded',
      tx_hash: TX,
    });
    const log = buildLog('Released', { batchId: BATCH, supplier: SUPPLIER, amount: 5000n });
    const engine = createIndexerEngine({
      chain: fakeChain([log]),
      db,
      logger: silentLogger,
    });
    await engine.processRange({ ...source }, 100n, 100n);

    const deal = db.upserts.find((u) => u.table === 'deals');
    expect(deal?.row.state).toBe('released');
    // Preserved from the seeded row.
    expect(deal?.row.buyer).toBe(BUYER);
  });

  it('does not dispatch when toBlock < fromBlock', async () => {
    const db = createFakeDb(true);
    const engine = createIndexerEngine({
      chain: fakeChain([buildLog('Funded', {
        batchId: BATCH,
        buyer: BUYER,
        supplier: SUPPLIER,
        token: TOKEN,
        amount: 1n,
      })]),
      db,
      logger: silentLogger,
    });
    expect(await engine.processRange({ ...source }, 200n, 100n)).toBe(0);
  });
});

describe('cursor store', () => {
  it('falls back to in-memory when the DB is unconfigured', async () => {
    const db = createFakeDb(false);
    const cursors = createCursorStore(db, silentLogger);
    expect(await cursors.get('SettlementEscrow')).toBeNull();
    await cursors.set('SettlementEscrow', 4321n);
    expect(await cursors.get('SettlementEscrow')).toBe(4321n);
  });

  it('persists via db.upsert when configured', async () => {
    const db = createFakeDb(true);
    const cursors = createCursorStore(db, silentLogger);
    await cursors.set('SettlementEscrow', 99n);
    const row = db.upserts.find((u) => u.table === 'indexer_cursors');
    expect(row?.row).toEqual({ key: 'SettlementEscrow', last_block: '99' });
  });
});
