/**
 * Test support for the domain routers: a filtering in-memory {@link Db} and a
 * helper to mount a single router plugin on a throwaway Fastify instance with a
 * fully-formed {@link AppContext}.
 *
 * Unlike `test/helpers.ts`'s `createFakeDb` (which returns empty lists), this
 * double actually applies equality filters — including PostgREST `args->>key`
 * JSON paths — plus ordering and range, so list/detail/search/aggregation
 * behavior can be asserted end to end via `app.inject`.
 */
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify';
import type { AppContext } from '../../src/context.js';
import type { ChainReader } from '../../src/lib/chain.js';
import type { Db, FilterValue, ListOptions } from '../../src/lib/db.js';
import { loadConfig } from '../../src/config/env.js';
import { fail } from '../../src/lib/envelope.js';
import { toApiError } from '../../src/lib/errors.js';
import { silentLogger } from '../helpers.js';

type Row = Record<string, unknown>;

/** Resolve a column value, supporting `args->>key` JSON-path lookups. */
const resolve = (row: Row, column: string): unknown => {
  const jsonPath = /^(\w+)->>(\w+)$/.exec(column);
  if (jsonPath !== null) {
    const container = row[jsonPath[1] as string];
    if (container !== null && typeof container === 'object') {
      return (container as Row)[jsonPath[2] as string];
    }
    return undefined;
  }
  return row[column];
};

const matchesAll = (
  row: Row,
  filters?: Readonly<Record<string, FilterValue>>,
): boolean => {
  if (filters === undefined) return true;
  return Object.entries(filters).every(([column, value]) => {
    const actual = resolve(row, column);
    if (actual === value) return true;
    // Loose compare so `'123' === 123` and boolean/string forms line up.
    return actual !== undefined && actual !== null && String(actual) === String(value);
  });
};

export interface MemoryDb extends Db {
  seed(table: string, rows: readonly Row[]): void;
}

/** Build a filtering in-memory Db seeded per table. */
export const createMemoryDb = (configured = true): MemoryDb => {
  const tables = new Map<string, Row[]>();
  const rowsOf = (table: string): Row[] => tables.get(table) ?? [];

  return {
    isConfigured: configured,
    seed(table, rows) {
      tables.set(table, [...rows]);
    },
    async list<T = Row>(table: string, options: ListOptions = {}): Promise<T[]> {
      let rows = rowsOf(table).filter((r) => matchesAll(r, options.filters));
      if (options.order !== undefined) {
        const { column, ascending = true } = options.order;
        rows = [...rows].sort((a, b) => {
          const av = String(resolve(a, column) ?? '');
          const bv = String(resolve(b, column) ?? '');
          const cmp = av < bv ? -1 : av > bv ? 1 : 0;
          return ascending ? cmp : -cmp;
        });
      }
      const offset = options.offset ?? 0;
      const limit = options.limit ?? rows.length;
      return rows.slice(offset, offset + limit) as T[];
    },
    async count(table, filters): Promise<number> {
      return rowsOf(table).filter((r) => matchesAll(r, filters)).length;
    },
    async getBy<T = Row>(
      table: string,
      column: string,
      value: FilterValue,
    ): Promise<T | null> {
      const found = rowsOf(table).find((r) => resolve(r, column) === value);
      return (found as T) ?? null;
    },
    async upsert<T = Row>(table: string, row: Row): Promise<T> {
      return row as T;
    },
    async insert<T = Row>(_table: string, row: Row): Promise<T> {
      return row as T;
    },
  };
};

/** A no-op ChainReader — the domain routers are DB-only, so reads never fire. */
export const stubChain: ChainReader = {
  chainId: 84_532,
  client: {} as never,
  async getBlockNumber() {
    return 1n;
  },
  async getLogs() {
    return [];
  },
  addressOf: () => undefined,
  abiOf: () => undefined,
  sources: () => [],
} as unknown as ChainReader;

/** Build an AppContext around a MemoryDb for router tests. */
export const makeContext = (db: Db): AppContext => ({
  config: loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' }),
  logger: silentLogger,
  chain: stubChain,
  db,
});

/** Mount one router plugin on a throwaway Fastify instance. */
export const mountRouter = async (
  plugin: FastifyPluginAsync,
  ctx: AppContext,
): Promise<FastifyInstance> => {
  const app = Fastify();
  app.decorate('appContext', ctx);
  // Mirror server.ts's uniform error envelope so thrown ApiErrors render as
  // `{ success:false, error:{ code, message } }` with the right status code.
  app.setErrorHandler((error, _request, reply) => {
    const apiErr = toApiError(error);
    return reply.code(apiErr.statusCode).send(
      fail({
        code: apiErr.code,
        message: apiErr.message,
        ...(apiErr.details !== undefined ? { details: apiErr.details } : {}),
      }),
    );
  });
  await app.register(plugin);
  await app.ready();
  return app;
};
