/**
 * Verdict pinning. Pins the full verdict JSON to IPFS and returns an
 * `ipfs://<cid>` URI. When PINATA_JWT is unset, a deterministic local no-op
 * fallback returns `ipfs://mock/<sha256>` so the system runs end-to-end with no
 * external account (mirrors the infra package's documented fallback behaviour).
 */
import { sha256Hex } from '../util/hashing.js';
import { chainError, errorMessage } from '../errors.js';
import type { Logger } from '../logger.js';

export interface VerdictPinner {
  /** Pins a JSON-serializable object and returns its ipfs:// URI. */
  pinJson(value: unknown): Promise<string>;
}

const canonicalJson = (value: unknown): string => JSON.stringify(value);

export const createLocalPinner = (): VerdictPinner => ({
  async pinJson(value: unknown): Promise<string> {
    const digest = sha256Hex(new TextEncoder().encode(canonicalJson(value)));
    return `ipfs://mock/${digest}`;
  },
});

export const createPinataPinner = (
  jwt: string,
  logger: Logger,
): VerdictPinner => ({
  async pinJson(value: unknown): Promise<string> {
    try {
      const res = await fetch(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ pinataContent: value }),
        },
      );
      if (!res.ok) {
        throw chainError(`Pinata pin failed (${res.status})`);
      }
      const body = (await res.json()) as { IpfsHash?: string };
      if (typeof body.IpfsHash !== 'string') {
        throw chainError('Pinata response missing IpfsHash');
      }
      return `ipfs://${body.IpfsHash}`;
    } catch (err) {
      // Degrade gracefully: log and fall back to the local mock URI so a
      // storage outage never blocks an otherwise-valid attestation.
      logger.warn(
        { err: errorMessage(err) },
        'Pinata pin failed; using local fallback URI',
      );
      return createLocalPinner().pinJson(value);
    }
  },
});

export const createPinner = (
  jwt: string | undefined,
  logger: Logger,
): VerdictPinner =>
  jwt !== undefined ? createPinataPinner(jwt, logger) : createLocalPinner();
