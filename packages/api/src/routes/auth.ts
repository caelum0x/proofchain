/**
 * /auth — Sign-In with Ethereum (SIWE / EIP-4361).
 *
 * Thin HTTP adapter over `AuthService`: mint a challenge nonce, then verify a
 * signed SIWE message. The API holds no wallet and no session cookie — a
 * successful verify returns the proven address + claims in the standard
 * envelope; the caller decides how to use it (e.g. issue its own token).
 *   - POST /auth/nonce           → mint a login nonce
 *   - POST /auth/verify          → verify a signed SIWE message
 */
import { z } from 'zod';
import { ok } from '../lib/envelope.js';
import { parseOr400 } from '../lib/reads.js';
import { defineRoutes } from '../lib/route.js';
import { createAuthService } from '../services/auth.js';

const VerifyBody = z.object({
  message: z.string().min(1, 'message is required'),
  signature: z
    .string()
    .regex(/^0x[0-9a-fA-F]+$/u, 'signature must be a 0x-prefixed hex string'),
  domain: z.string().min(1).optional(),
  nonce: z.string().min(1).optional(),
});

export default defineRoutes((app, ctx) => {
  const auth = createAuthService(ctx);

  app.post('/auth/nonce', async () => ok(auth.createNonce()));

  app.post('/auth/verify', async (request) => {
    const { message, signature, domain, nonce } = parseOr400(
      VerifyBody,
      request.body,
    );
    const session = await auth.verify({
      message,
      signature: signature as `0x${string}`,
      ...(domain !== undefined ? { domain } : {}),
      ...(nonce !== undefined ? { nonce } : {}),
    });
    return ok(session);
  });
});
