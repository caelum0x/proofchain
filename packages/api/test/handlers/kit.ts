/**
 * Shared kit for indexer-handler unit tests.
 *
 * Handlers consume a {@link DecodedEvent} (already normalized by the engine:
 * bigints → base-10 strings, small uints/enums → `number`). These helpers build
 * such events directly so a handler can be exercised without any ABI encoding,
 * chain, or Supabase — fully offline. Re-exports the in-memory fake Db + silent
 * logger from the top-level test helpers.
 */
import type { DecodedEvent, HandlerDeps } from '../../src/indexer/types.js';
import { createFakeDb, silentLogger, type FakeDb } from '../helpers.js';

export { createFakeDb, silentLogger } from '../helpers.js';
export type { FakeDb } from '../helpers.js';

const DEFAULT_TX = ('0x' + '22'.repeat(32)) as `0x${string}`;
const DEFAULT_ADDR = '0x00000000000000000000000000000000000000ab' as const;

/** Build a decoded event for a handler test. `contract`/`args` are the essentials. */
export const makeEvent = (input: {
  contract: string;
  eventName: string;
  args: Record<string, unknown>;
  group?: string;
  address?: string;
  transactionHash?: string;
  logIndex?: number;
  blockNumber?: bigint;
}): DecodedEvent =>
  ({
    group: input.group ?? 'test',
    contract: input.contract,
    address: (input.address ?? DEFAULT_ADDR) as `0x${string}`,
    eventName: input.eventName,
    args: input.args,
    blockNumber: input.blockNumber ?? 100n,
    transactionHash: (input.transactionHash ?? DEFAULT_TX) as `0x${string}`,
    logIndex: input.logIndex ?? 0,
  }) as DecodedEvent;

/** Build the {@link HandlerDeps} with a fresh fake Db + silent logger. */
export const makeDeps = (configured = true): { db: FakeDb; deps: HandlerDeps } => {
  const db = createFakeDb(configured);
  return { db, deps: { db, logger: silentLogger } };
};
