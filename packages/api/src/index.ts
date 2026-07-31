/**
 * Composition root. Loads + validates config (fail fast), builds every real
 * dependency, wires them into the Fastify server, optionally starts the event
 * indexer, and listens. No business logic lives here — it only assembles the
 * injectable pieces defined elsewhere.
 */
import { loadConfig } from './config/env.js';
import { createLogger } from './logger.js';
import { createChainReader } from './lib/chain.js';
import { createDb } from './lib/db.js';
import { buildServer } from './server.js';
import { createIndexerRunner, type IndexerRunner } from './indexer/runner.js';
import { ApiError } from './lib/errors.js';
import type { AppContext } from './context.js';

const main = async (): Promise<void> => {
  const config = loadConfig();
  const logger = createLogger(config);

  const chain = createChainReader(config, logger);
  const db = await createDb(config, logger);
  const ctx: AppContext = { config, logger, chain, db };

  const app = await buildServer(ctx);

  let indexer: IndexerRunner | null = null;
  if (config.INDEXER_ENABLED) {
    indexer = createIndexerRunner(ctx);
    indexer.start();
  } else {
    logger.info('indexer disabled (set INDEXER_ENABLED=true to enable)');
  }

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    if (indexer !== null) await indexer.stop();
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port: config.API_PORT, host: config.HOST });
  logger.info(
    { port: config.API_PORT, host: config.HOST, chainId: config.CHAIN_ID, db: db.isConfigured },
    'api listening',
  );
};

main().catch((err: unknown) => {
  const message =
    err instanceof ApiError ? err.message : (err as Error).message ?? String(err);
  // eslint-disable-next-line no-console -- logger may not exist yet at boot.
  console.error(`Fatal startup error: ${message}`);
  process.exit(1);
});
