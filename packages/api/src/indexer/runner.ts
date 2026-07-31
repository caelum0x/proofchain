/**
 * Indexer runner — the scheduling loop around the engine.
 *
 * On each tick it reads the chain head, subtracts the configured confirmations
 * (reorg safety), and for every deployed contract advances its cursor by up to
 * `INDEXER_BLOCK_RANGE` blocks, processing that window and persisting the new
 * cursor. Ticks never overlap (a re-entrancy guard skips a tick still running),
 * and a failure in one tick is logged and retried on the next interval rather
 * than crashing the service.
 */
import type { AppContext } from '../context.js';
import { errorMessage } from '../lib/errors.js';
import {
  createCursorStore,
  createIndexerEngine,
  type CursorStore,
  type IndexerEngine,
} from './indexer.js';

export interface IndexerRunner {
  /** Run exactly one polling tick across all sources. Returns events dispatched. */
  tick(): Promise<number>;
  /** Start the interval loop (no-op if already started). */
  start(): void;
  /** Stop the loop and wait for any in-flight tick to finish. */
  stop(): Promise<void>;
}

interface RunnerState {
  timer: NodeJS.Timeout | null;
  ticking: boolean;
  stopped: boolean;
}

/**
 * Build (but do not start) an indexer runner. Call `.start()` to begin polling.
 * Exposed as a factory so tests can drive `.tick()` deterministically.
 */
export const createIndexerRunner = (ctx: AppContext): IndexerRunner => {
  const { config, chain, db, logger } = ctx;
  const engine: IndexerEngine = createIndexerEngine({ chain, db, logger });
  const cursors: CursorStore = createCursorStore(db, logger);
  const state: RunnerState = { timer: null, ticking: false, stopped: false };

  const tick = async (): Promise<number> => {
    const sources = chain.sources();
    if (sources.length === 0) return 0;

    const head = await chain.getBlockNumber();
    const safeHead = head > config.INDEXER_CONFIRMATIONS
      ? head - config.INDEXER_CONFIRMATIONS
      : 0n;
    if (safeHead === 0n) return 0;

    let total = 0;
    for (const source of sources) {
      const cursor = await cursors.get(source.name);
      const fromBlock = cursor === null ? config.INDEXER_START_BLOCK : cursor + 1n;
      if (fromBlock > safeHead) continue;
      const maxTo = fromBlock + config.INDEXER_BLOCK_RANGE - 1n;
      const toBlock = maxTo < safeHead ? maxTo : safeHead;

      const dispatched = await engine.processRange(source, fromBlock, toBlock);
      await cursors.set(source.name, toBlock);
      total += dispatched;
      logger.debug(
        { contract: source.name, fromBlock: fromBlock.toString(), toBlock: toBlock.toString(), dispatched },
        'indexer: processed range',
      );
    }
    return total;
  };

  const safeTick = async (): Promise<void> => {
    if (state.ticking || state.stopped) return;
    state.ticking = true;
    try {
      const dispatched = await tick();
      if (dispatched > 0) {
        logger.info({ dispatched }, 'indexer: tick complete');
      }
    } catch (err) {
      logger.error({ cause: errorMessage(err) }, 'indexer: tick failed');
    } finally {
      state.ticking = false;
    }
  };

  return {
    tick,
    start(): void {
      if (state.timer !== null) return;
      state.stopped = false;
      logger.info(
        { intervalMs: config.INDEXER_INTERVAL_MS, sources: chain.sources().length },
        'indexer: starting',
      );
      state.timer = setInterval(() => {
        void safeTick();
      }, config.INDEXER_INTERVAL_MS);
      // Do not keep the process alive solely for the indexer.
      state.timer.unref?.();
      // Kick an immediate first tick.
      void safeTick();
    },
    async stop(): Promise<void> {
      state.stopped = true;
      if (state.timer !== null) {
        clearInterval(state.timer);
        state.timer = null;
      }
      // Wait for an in-flight tick to drain.
      while (state.ticking) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      logger.info('indexer: stopped');
    },
  };
};
