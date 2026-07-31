/**
 * Auth service — Sign-In with Ethereum (EIP-4361 / SIWE).
 *
 * The API is a read/index service with NO wallet, so "auth" here is stateless
 * proof-of-address: a client requests a `nonce`, signs a SIWE message with its
 * wallet, and posts `{ message, signature }` back to `verify`. Verification is
 * fully OFFLINE — signature recovery is pure cryptography (viem's
 * `recoverMessageAddress`), and structural/temporal checks use viem's SIWE
 * helpers — so no RPC round-trip is needed for EOA wallets and the service is
 * deterministically unit-testable.
 *
 * On a successful verify the resulting session is best-effort persisted to the
 * `auth_sessions` read-model table (when Supabase is configured); persistence
 * never fails the verification (the proof stands on its own).
 */
import { recoverMessageAddress } from 'viem';
import {
  generateSiweNonce,
  parseSiweMessage,
  validateSiweMessage,
} from 'viem/siwe';
import { validationError } from '../lib/errors.js';
import { defineService } from './base.js';

/** A freshly-minted login nonce plus its issue time (for optional persistence). */
export interface AuthNonce {
  readonly nonce: string;
  readonly issuedAt: string;
}

export interface VerifyInput {
  /** The exact SIWE message the wallet signed (EIP-4361 text). */
  readonly message: string;
  /** The `personal_sign` signature over `message`, 0x-hex. */
  readonly signature: `0x${string}`;
  /** Optional expected domain — enforced when provided. */
  readonly domain?: string;
  /** Optional expected nonce — enforced when provided. */
  readonly nonce?: string;
}

/** The authenticated session derived from a valid SIWE proof. */
export interface AuthSession {
  readonly address: string;
  readonly chainId: number | null;
  readonly domain: string | null;
  readonly uri: string | null;
  readonly issuedAt: string | null;
  readonly expirationTime: string | null;
}

export interface AuthService {
  /** Mint a random login nonce for a SIWE challenge. */
  createNonce(): AuthNonce;
  /** Verify a signed SIWE message, returning the authenticated session. */
  verify(input: VerifyInput): Promise<AuthSession>;
}

const HEX_SIGNATURE = /^0x[0-9a-fA-F]+$/u;

/** Build an {@link AuthService} bound to the request context. */
export const createAuthService = defineService<AuthService>((ctx) => {
  const persistSession = async (session: AuthSession): Promise<void> => {
    if (!ctx.db.isConfigured) return;
    try {
      await ctx.db.upsert(
        'auth_sessions',
        {
          address: session.address,
          chain_id: session.chainId,
          domain: session.domain,
          uri: session.uri,
          issued_at: session.issuedAt,
          expires_at: session.expirationTime,
        },
        'address',
      );
    } catch (err) {
      // Persistence is best-effort — the cryptographic proof is authoritative.
      ctx.logger.warn({ err }, 'auth: failed to persist session');
    }
  };

  return {
    createNonce(): AuthNonce {
      return { nonce: generateSiweNonce(), issuedAt: new Date().toISOString() };
    },

    async verify({ message, signature, domain, nonce }): Promise<AuthSession> {
      if (typeof message !== 'string' || message.length === 0) {
        throw validationError('SIWE message is required');
      }
      if (!HEX_SIGNATURE.test(signature)) {
        throw validationError('signature must be a 0x-prefixed hex string');
      }

      const fields = parseSiweMessage(message);
      if (fields.address === undefined) {
        throw validationError('SIWE message is missing an address field');
      }

      // Structural + temporal validation (expiry / notBefore / domain / nonce).
      const structurallyValid = validateSiweMessage({
        message: fields,
        ...(domain !== undefined ? { domain } : {}),
        ...(nonce !== undefined ? { nonce } : {}),
      });
      if (!structurallyValid) {
        throw validationError(
          'SIWE message failed validation (domain, nonce, or time window)',
        );
      }

      // Pure, offline signature recovery — no RPC needed for EOA wallets.
      const recovered = await recoverMessageAddress({ message, signature });
      if (recovered.toLowerCase() !== fields.address.toLowerCase()) {
        throw validationError('signature does not match the SIWE address');
      }

      const session: AuthSession = {
        address: fields.address.toLowerCase(),
        chainId: fields.chainId ?? null,
        domain: fields.domain ?? null,
        uri: fields.uri ?? null,
        issuedAt: fields.issuedAt?.toISOString() ?? null,
        expirationTime: fields.expirationTime?.toISOString() ?? null,
      };
      await persistSession(session);
      return session;
    },
  };
});
