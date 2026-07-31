/**
 * Admin service — operational status + non-secret configuration for operators.
 *
 * Backs an internal `/admin` surface: is the chain reachable, is Supabase wired,
 * which contracts are deployed, how far has the indexer progressed, and how many
 * rows sit in each read-model table. It is defensive by construction — a chain
 * RPC failure degrades to `reachable:false` instead of failing the whole status
 * call — and it NEVER echoes a secret (the config projection is an explicit
 * allowlist; SUPABASE_URL / service-role key are reduced to a boolean).
 */
import { errorMessage } from '../lib/errors.js';
import { defineService } from './base.js';

/** Read-model tables surfaced by `/admin/tables` row counts. */
export const ADMIN_TABLES = [
  'suppliers',
  'deals',
  'receivables',
  'financing_listings',
  'pools',
  'policies',
  'claims',
  'disputes',
  'proposals',
  'listings',
  'auctions',
  'rewards',
  'notifications',
  'indexer_events',
] as const;

export interface AdminStatus {
  readonly db: { readonly configured: boolean };
  readonly chain: {
    readonly chainId: number;
    readonly reachable: boolean;
    readonly blockNumber: string | null;
  };
  readonly contracts: readonly { readonly name: string; readonly address: string }[];
  readonly indexer: { readonly cursors: number; readonly maxBlock: string | null };
}

export interface AdminConfig {
  readonly nodeEnv: string;
  readonly chainId: number;
  readonly apiPort: number;
  readonly corsOrigin: string;
  readonly rateLimit: { readonly max: number; readonly windowMs: number };
  readonly indexer: { readonly enabled: boolean; readonly intervalMs: number };
  readonly supabaseConfigured: boolean;
}

export interface AdminService {
  /** System status: db, chain reachability, deployed contracts, indexer progress. */
  status(): Promise<AdminStatus>;
  /** Non-secret configuration projection (no credentials ever). */
  config(): AdminConfig;
  /** Row counts for each known read-model table. */
  tables(): Promise<Readonly<Record<string, number>>>;
}

/** Build an {@link AdminService} bound to the request context. */
export const createAdminService = defineService<AdminService>((ctx) => {
  const { chain, db, config, logger } = ctx;

  const readBlockNumber = async (): Promise<bigint | null> => {
    try {
      return await chain.getBlockNumber();
    } catch (err) {
      logger.warn({ err: errorMessage(err) }, 'admin: chain unreachable');
      return null;
    }
  };

  const indexerProgress = async (): Promise<{ cursors: number; maxBlock: string | null }> => {
    const rows = await db.list<{ last_block: string | number }>('indexer_cursors', {
      limit: 500,
    });
    let max = -1n;
    for (const row of rows) {
      try {
        const value = BigInt(row.last_block);
        if (value > max) max = value;
      } catch {
        // Ignore a corrupt cursor value; it never blocks a status read.
      }
    }
    return { cursors: rows.length, maxBlock: max < 0n ? null : max.toString() };
  };

  return {
    async status(): Promise<AdminStatus> {
      const [blockNumber, progress] = await Promise.all([
        readBlockNumber(),
        indexerProgress(),
      ]);
      const contracts = chain.sources().map((s) => ({
        name: s.name,
        address: s.address,
      }));
      return {
        db: { configured: db.isConfigured },
        chain: {
          chainId: chain.chainId,
          reachable: blockNumber !== null,
          blockNumber: blockNumber === null ? null : blockNumber.toString(),
        },
        contracts,
        indexer: progress,
      };
    },

    config(): AdminConfig {
      return {
        nodeEnv: config.NODE_ENV,
        chainId: config.CHAIN_ID,
        apiPort: config.API_PORT,
        corsOrigin: config.CORS_ORIGIN,
        rateLimit: {
          max: config.RATE_LIMIT_MAX,
          windowMs: config.RATE_LIMIT_WINDOW_MS,
        },
        indexer: {
          enabled: config.INDEXER_ENABLED,
          intervalMs: config.INDEXER_INTERVAL_MS,
        },
        supabaseConfigured:
          config.SUPABASE_URL !== undefined &&
          config.SUPABASE_SERVICE_ROLE_KEY !== undefined,
      };
    },

    async tables(): Promise<Readonly<Record<string, number>>> {
      const counts = await Promise.all(ADMIN_TABLES.map((t) => db.count(t)));
      const out: Record<string, number> = {};
      ADMIN_TABLES.forEach((table, i) => {
        out[table] = counts[i] ?? 0;
      });
      return out;
    },
  };
});
