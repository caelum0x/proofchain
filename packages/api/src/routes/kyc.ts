/**
 * /kyc — KYC status attestations per address (M3 KYCRegistry).
 *
 * List (optionally filtered by exact level) reads the indexed `kyc` read model;
 * detail is DB-first and falls back to the on-chain `kycOf`/`isVerified` views.
 * An address with no KYC is a valid answer (level 0, verified=false), so detail
 * never 404s for a well-formed address — it reports the current status.
 */
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { ok, okPage } from '../lib/envelope.js';
import { pageMeta, parsePagination } from '../lib/pagination.js';
import {
  hexAddress,
  parseOr400,
  readView,
  resolveContract,
} from '../lib/reads.js';
import { defineRoutes } from '../lib/route.js';

interface KycRow {
  address: string;
  level: number;
  provider: string | null;
}

interface OnChainKyc {
  level: number;
  updatedAt: bigint;
  provider: string;
}

const TABLE = 'kyc';
const CONTRACT = 'KYCRegistry';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const ListQuery = z.object({
  level: z.coerce.number().int().min(0).max(255).optional(),
});
const AddressParams = z.object({ address: hexAddress });

const readChainKyc = async (
  ctx: AppContext,
  address: string,
): Promise<{ level: number; provider: string | null; verified: boolean } | null> => {
  const contract = resolveContract(ctx, CONTRACT);
  if (contract === null) return null;
  const kyc = (await readView(ctx, contract, 'kycOf', [address])) as
    | OnChainKyc
    | undefined;
  if (kyc === undefined) return null;
  const provider = kyc.provider.toLowerCase();
  return {
    level: Number(kyc.level),
    provider: provider === ZERO_ADDRESS ? null : provider,
    verified: Number(kyc.level) > 0,
  };
};

export default defineRoutes((app, ctx) => {
  app.get('/kyc', async (request) => {
    const { level } = parseOr400(ListQuery, request.query);
    const pagination = parsePagination(request.query);
    const filters = level !== undefined ? { level } : undefined;
    const [rows, total] = await Promise.all([
      ctx.db.list<KycRow>(TABLE, {
        ...pagination,
        order: { column: 'updated_at', ascending: false },
        filters,
      }),
      ctx.db.count(TABLE, filters),
    ]);
    return okPage(rows, pageMeta(total, pagination));
  });

  app.get('/kyc/:address', async (request) => {
    const { address } = parseOr400(AddressParams, request.params);
    const row = await ctx.db.getBy<KycRow>(TABLE, 'address', address);
    if (row !== null) {
      return ok({
        address,
        level: row.level,
        provider: row.provider,
        verified: row.level > 0,
        source: 'db' as const,
      });
    }

    const onChain = await readChainKyc(ctx, address);
    if (onChain === null) {
      // Contract not available and nothing indexed — report unknown status.
      return ok({
        address,
        level: 0,
        provider: null,
        verified: false,
        source: 'unknown' as const,
      });
    }
    return ok({ address, ...onChain, source: 'chain' as const });
  });
});
