/**
 * GET /health — readiness probe. Confirms env is loaded and the RPC/chain is
 * reachable. Returns 200 when healthy, 503 when the chain is unreachable.
 */
import type { FastifyInstance } from 'fastify';
import { ok } from '../../errors.js';
import type { AppDeps } from '../types.js';
import type { Hex } from '../../domain/types.js';

const ZERO_BATCH: Hex =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

export const registerHealthRoute = (
  app: FastifyInstance,
  deps: AppDeps,
): void => {
  app.get('/health', async (_request, reply) => {
    let chainOk = false;
    let chainError: string | undefined;
    try {
      // A cheap read that exercises RPC + contract wiring.
      await deps.chain.isAttested(ZERO_BATCH);
      chainOk = true;
    } catch (err) {
      chainError = (err as Error).message;
    }

    const body = {
      status: chainOk ? ('ok' as const) : ('degraded' as const),
      chainId: deps.config.CHAIN_ID,
      agentAddress: deps.chain.agentAddress,
      checks: {
        env: true,
        chain: chainOk,
        ...(chainError !== undefined ? { chainError } : {}),
      },
    };

    return reply.code(chainOk ? 200 : 503).send(ok(body));
  });
};
