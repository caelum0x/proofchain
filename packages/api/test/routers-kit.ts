/**
 * Shared test kit for the resource routers (batches, deals, suppliers, …).
 *
 * Provides a list-capable in-memory `Db`, a stubbable `ChainReader` (point-read
 * `readContract` keyed by function name), and a `buildApp` that decorates the
 * AppContext and registers a single router plugin — the same wiring the
 * autoloader does in production, minus the filesystem scan.
 */
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify';
import type { AppContext } from '../src/context.js';
import type { ChainReader } from '../src/lib/chain.js';
import type { Db, FilterValue, ListOptions } from '../src/lib/db.js';
import { loadConfig } from '../src/config/env.js';
import { fail } from '../src/lib/envelope.js';
import { toApiError } from '../src/lib/errors.js';
import { silentLogger } from './helpers.js';

export type Row = Record<string, unknown>;

const config = loadConfig({ BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org' });

const matchesFilters = (
  row: Row,
  filters?: Readonly<Record<string, FilterValue>>,
): boolean =>
  filters === undefined ||
  Object.entries(filters).every(([k, v]) => row[k] === v);

/** In-memory Db seeded per table; supports list (filter/order/paginate), count, getBy. */
export const makeDb = (
  data: Readonly<Record<string, readonly Row[]>> = {},
  configured = true,
): Db => ({
  isConfigured: configured,
  async list<T = Row>(table: string, options: ListOptions = {}): Promise<T[]> {
    let rows = [...(data[table] ?? [])].filter((r) => matchesFilters(r, options.filters));
    if (options.order !== undefined) {
      const { column, ascending = true } = options.order;
      rows = rows.sort((a, b) => {
        const av = a[column] as never;
        const bv = b[column] as never;
        if (av === bv) return 0;
        return (av < bv ? -1 : 1) * (ascending ? 1 : -1);
      });
    }
    const offset = options.offset ?? 0;
    const limit = options.limit ?? rows.length;
    return rows.slice(offset, offset + limit) as T[];
  },
  async count(table: string, filters?: Readonly<Record<string, FilterValue>>): Promise<number> {
    return (data[table] ?? []).filter((r) => matchesFilters(r, filters)).length;
  },
  async getBy<T = Row>(table: string, column: string, value: FilterValue): Promise<T | null> {
    return ((data[table] ?? []).find((r) => r[column] === value) as T) ?? null;
  },
  async upsert<T = Row>(_t: string, row: Row): Promise<T> {
    return row as T;
  },
  async insert<T = Row>(_t: string, row: Row): Promise<T> {
    return row as T;
  },
});

export interface FakeChainOptions {
  /** name → deployed (any truthy address/abi enables resolveContract). */
  readonly contracts?: Readonly<Record<string, boolean>>;
  /** functionName → value or (args) => value. Throws if a call is unstubbed. */
  readonly reads?: Readonly<
    Record<string, unknown | ((args: readonly unknown[]) => unknown)>
  >;
}

/** Build a stub ChainReader whose readContract is driven by `reads`. */
export const makeChain = (opts: FakeChainOptions = {}): ChainReader => {
  const client = {
    async readContract({
      functionName,
      args,
    }: {
      functionName: string;
      args?: readonly unknown[];
    }): Promise<unknown> {
      const stub = opts.reads?.[functionName];
      if (stub === undefined) {
        throw new Error(`unstubbed readContract: ${functionName}`);
      }
      return typeof stub === 'function' ? stub(args ?? []) : stub;
    },
  };
  return {
    chainId: 84_532,
    client: client as never,
    async getBlockNumber() {
      return 1n;
    },
    async getLogs() {
      return [];
    },
    addressOf: (name: string) =>
      opts.contracts?.[name] === true
        ? ('0x00000000000000000000000000000000000000aa' as never)
        : undefined,
    abiOf: (name: string) => (opts.contracts?.[name] === true ? ([] as never) : undefined),
    sources: () => [],
  } as unknown as ChainReader;
};

/** Register a router plugin on a fresh Fastify app with the given ctx pieces. */
export const buildApp = async (
  plugin: FastifyPluginAsync,
  parts: { db?: Db; chain?: ChainReader } = {},
): Promise<FastifyInstance> => {
  const ctx: AppContext = {
    config,
    logger: silentLogger,
    chain: parts.chain ?? makeChain(),
    db: parts.db ?? makeDb(),
  };
  const app = Fastify();
  app.decorate('appContext', ctx);
  // Mirror the production error envelope (see server.ts) so thrown ApiErrors
  // (notFound / validationError) surface as `{ success:false, error:{ code } }`.
  app.setErrorHandler((error: Error & { validation?: unknown }, _request, reply) => {
    if (error.validation !== undefined) {
      return reply.code(400).send(
        fail({
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: (error as { validation?: unknown }).validation,
        }),
      );
    }
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
