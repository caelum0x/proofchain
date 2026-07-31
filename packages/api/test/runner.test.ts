import { describe, expect, it } from 'vitest';
// Resolves to test/doubles/shared.ts via the vitest alias.
import { ABIS } from '@proofchain/shared';
import { loadConfig } from '../src/config/env.js';
import type { AppContext } from '../src/context.js';
import type { ChainReader, ContractSource } from '../src/lib/chain.js';
import { createIndexerRunner } from '../src/indexer/runner.js';
import { createFakeDb, silentLogger } from './helpers.js';

const source: ContractSource = {
  name: 'SettlementEscrow' as never,
  address: '0x00000000000000000000000000000000000000e5',
  abi: ABIS.SettlementEscrow,
};

const fakeChain = (head: bigint): ChainReader =>
  ({
    chainId: 84_532,
    client: {} as never,
    async getBlockNumber() {
      return head;
    },
    async getLogs() {
      return [];
    },
    addressOf: () => source.address,
    abiOf: () => ABIS.SettlementEscrow,
    sources: () => [source],
  }) as unknown as ChainReader;

const config = loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' });

describe('indexer runner tick', () => {
  it('advances a cursor to safeHead and skips when nothing new remains', async () => {
    const db = createFakeDb(true);
    const ctx: AppContext = { config, logger: silentLogger, chain: fakeChain(100n), db };
    const runner = createIndexerRunner(ctx);

    // First tick: cold cursor → process [start, head - confirmations] = [0, 98].
    expect(await runner.tick()).toBe(0); // no logs to dispatch
    const cursorWrites = db.upserts.filter((u) => u.table === 'indexer_cursors');
    expect(cursorWrites).toHaveLength(1);
    expect(cursorWrites[0]?.row).toEqual({ key: 'SettlementEscrow', last_block: '98' });

    // Second tick: cursor at 98, safeHead 98 → fromBlock 99 > 98 → skip, no new write.
    expect(await runner.tick()).toBe(0);
    expect(db.upserts.filter((u) => u.table === 'indexer_cursors')).toHaveLength(1);
  });

  it('does nothing when there are no deployed sources', async () => {
    const db = createFakeDb(true);
    const chain = {
      ...fakeChain(100n),
      sources: () => [],
    } as unknown as ChainReader;
    const runner = createIndexerRunner({ config, logger: silentLogger, chain, db });
    expect(await runner.tick()).toBe(0);
    expect(db.upserts).toHaveLength(0);
  });
});
