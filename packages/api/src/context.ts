/**
 * AppContext — the dependency bundle injected into every router and the indexer.
 *
 * It is decorated onto the Fastify instance as `app.appContext` BEFORE the
 * autoloader registers routers, so each auto-loaded plugin reaches its
 * dependencies through the typed context instead of module-level singletons.
 * This keeps routers pure (config/logger/chain/db injected) and unit-testable.
 */
import type { ApiConfig } from './config/env.js';
import type { Logger } from './logger.js';
import type { ChainReader } from './lib/chain.js';
import type { Db } from './lib/db.js';

export interface AppContext {
  readonly config: ApiConfig;
  readonly logger: Logger;
  readonly chain: ChainReader;
  readonly db: Db;
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Injected dependency bundle. Present on every instance built by buildServer. */
    appContext: AppContext;
  }
}
