/**
 * Indexer engine.
 *
 * Given a {@link ChainReader}, it scans event logs for a block range from every
 * deployed contract, DECODES them against the contract ABI, routes each event to
 * its group handler, and tracks a per-contract cursor so restarts resume exactly
 * where they left off (with configurable confirmations to tolerate reorgs). The
 * loop/scheduling lives in `runner.ts`; this module is pure "scan → decode →
 * dispatch" and is fully unit-testable with a fake chain + in-memory cursor.
 */
import { decodeEventLog, type Log } from 'viem';
import type { ChainReader, ContractSource } from '../lib/chain.js';
import { ApiError, errorMessage } from '../lib/errors.js';
import type { Db } from '../lib/db.js';
import type { Logger } from '../logger.js';
import { getHandler } from './handlers/index.js';
import { groupFor, type DecodedEvent, type HandlerDeps } from './types.js';

/** Persists the last fully-processed block per cursor key. */
export interface CursorStore {
  get(key: string): Promise<bigint | null>;
  set(key: string, block: bigint): Promise<void>;
}

export interface IndexerEngine {
  /** Process one range for a single contract source; returns events dispatched. */
  processRange(
    source: ContractSource,
    fromBlock: bigint,
    toBlock: bigint,
  ): Promise<number>;
}

export interface IndexerEngineDeps {
  readonly chain: ChainReader;
  readonly db: Db;
  readonly logger: Logger;
}

/** Recursively convert bigints to strings so args serialize to JSONB safely. */
export const jsonSafe = (value: unknown): unknown => {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = jsonSafe(v);
    }
    return out;
  }
  return value;
};

/** Normalize decoded args (object or positional array) into a plain record. */
const toArgsRecord = (args: unknown): Record<string, unknown> => {
  const safe = jsonSafe(args);
  if (safe !== null && typeof safe === 'object' && !Array.isArray(safe)) {
    return safe as Record<string, unknown>;
  }
  // Anonymous / positional-only events: keep values under numeric keys.
  return { values: safe };
};

/**
 * Decode a single raw log against a source's ABI into a {@link DecodedEvent}.
 * Returns null for logs that don't match the ABI or that lack block/tx position
 * (pending logs) — those are skipped rather than throwing.
 */
export const decodeLog = (
  source: ContractSource,
  log: Log,
): DecodedEvent | null => {
  if (log.blockNumber === null || log.transactionHash === null || log.logIndex === null) {
    return null;
  }
  try {
    const decoded = decodeEventLog({
      abi: source.abi,
      data: log.data,
      topics: log.topics,
    });
    if (decoded.eventName === undefined) return null;
    return {
      group: groupFor(source.name),
      contract: source.name,
      address: source.address,
      eventName: decoded.eventName,
      args: toArgsRecord(decoded.args),
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex,
    };
  } catch {
    // Log topic not part of this ABI (or malformed) — not our event; skip.
    return null;
  }
};

/** Create the engine. `processRange` scans, decodes, and dispatches one range. */
export const createIndexerEngine = (deps: IndexerEngineDeps): IndexerEngine => {
  const handlerDeps: HandlerDeps = { db: deps.db, logger: deps.logger };

  return {
    async processRange(
      source: ContractSource,
      fromBlock: bigint,
      toBlock: bigint,
    ): Promise<number> {
      if (toBlock < fromBlock) return 0;

      const logs = await deps.chain.getLogs({
        address: source.address,
        fromBlock,
        toBlock,
      });

      // Deterministic order: by block, then log index within a block.
      const ordered = [...logs].sort((a, b) => {
        const ab = a.blockNumber ?? 0n;
        const bb = b.blockNumber ?? 0n;
        if (ab !== bb) return ab < bb ? -1 : 1;
        return (a.logIndex ?? 0) - (b.logIndex ?? 0);
      });

      let dispatched = 0;
      for (const log of ordered) {
        const event = decodeLog(source, log);
        if (event === null) continue;
        const handler = getHandler(event.group);
        try {
          await handler.handle(event, handlerDeps);
          dispatched += 1;
        } catch (err) {
          // One bad event must not abort the whole range; surface it and move on.
          if (err instanceof ApiError) {
            deps.logger.error(
              { err: err.code, msg: err.message, event: event.eventName, contract: source.name },
              'indexer: handler failed for event',
            );
          } else {
            deps.logger.error(
              { cause: errorMessage(err), event: event.eventName, contract: source.name },
              'indexer: handler threw',
            );
          }
        }
      }
      return dispatched;
    },
  };
};

/**
 * Supabase-backed cursor store with an in-memory fallback when the DB is
 * unconfigured (so the indexer still runs locally without persistence). Cursors
 * are stored in the `indexer_cursors` table keyed by the contract name.
 */
export const createCursorStore = (db: Db, logger: Logger): CursorStore => {
  const memory = new Map<string, bigint>();

  return {
    async get(key: string): Promise<bigint | null> {
      if (!db.isConfigured) {
        return memory.get(key) ?? null;
      }
      const row = await db.getBy<{ last_block: string | number }>(
        'indexer_cursors',
        'key',
        key,
      );
      if (row === null) return null;
      try {
        return BigInt(row.last_block);
      } catch {
        logger.warn({ key, value: row.last_block }, 'indexer: corrupt cursor; ignoring');
        return null;
      }
    },

    async set(key: string, block: bigint): Promise<void> {
      if (!db.isConfigured) {
        memory.set(key, block);
        return;
      }
      await db.upsert(
        'indexer_cursors',
        { key, last_block: block.toString() },
        'key',
      );
    },
  };
};
