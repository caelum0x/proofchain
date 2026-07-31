/**
 * GET /health — readiness probe (auto-registered by the autoloader).
 *
 * This is the reference implementation of the router convention: default-export
 * `defineRoutes(async (app, ctx) => { ... })`, read dependencies from `ctx`,
 * and `return ok(payload)`. It confirms env is loaded, reports whether Supabase
 * persistence is configured, and pings the RPC with a cheap block-number read.
 * Returns 200 when the chain is reachable, 503 when it is not.
 */
import { ok } from '../lib/envelope.js';
import { errorMessage } from '../lib/errors.js';
import { defineRoutes } from '../lib/route.js';

export default defineRoutes((app, ctx) => {
  app.get('/health', async (_request, reply) => {
    let chainOk = false;
    let blockNumber: string | undefined;
    let chainErr: string | undefined;
    try {
      const bn = await ctx.chain.getBlockNumber();
      blockNumber = bn.toString();
      chainOk = true;
    } catch (err) {
      chainErr = errorMessage(err);
    }

    const body = {
      status: chainOk ? ('ok' as const) : ('degraded' as const),
      service: '@proofchain/api',
      chainId: ctx.chain.chainId,
      contracts: ctx.chain.sources().length,
      checks: {
        env: true,
        db: ctx.db.isConfigured,
        chain: chainOk,
        ...(blockNumber !== undefined ? { blockNumber } : {}),
        ...(chainErr !== undefined ? { chainError: chainErr } : {}),
      },
    };

    return reply.code(chainOk ? 200 : 503).send(ok(body));
  });
});
