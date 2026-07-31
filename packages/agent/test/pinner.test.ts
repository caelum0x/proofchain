import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createLocalPinner,
  createPinner,
  createPinataPinner,
} from '../src/verdict/pinner.js';
import { silentLogger } from './helpers.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('pinner', () => {
  it('local pinner returns a deterministic ipfs://mock/<sha256> uri', async () => {
    const pinner = createLocalPinner();
    const a = await pinner.pinJson({ a: 1 });
    const b = await pinner.pinJson({ a: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^ipfs:\/\/mock\/[0-9a-f]{64}$/);
  });

  it('createPinner falls back to local when no jwt is provided', async () => {
    const pinner = createPinner(undefined, silentLogger());
    expect(await pinner.pinJson({ x: 1 })).toMatch(/^ipfs:\/\/mock\//);
  });

  it('pinata pinner returns ipfs://<cid> on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ IpfsHash: 'QmAbc' }), { status: 200 }),
      ),
    );
    const pinner = createPinataPinner('jwt', silentLogger());
    expect(await pinner.pinJson({ x: 1 })).toBe('ipfs://QmAbc');
  });

  it('pinata pinner degrades to local fallback on HTTP failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    const pinner = createPinataPinner('jwt', silentLogger());
    expect(await pinner.pinJson({ x: 1 })).toMatch(/^ipfs:\/\/mock\//);
  });

  it('pinata pinner degrades to local fallback on network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );
    const pinner = createPinataPinner('jwt', silentLogger());
    expect(await pinner.pinJson({ x: 1 })).toMatch(/^ipfs:\/\/mock\//);
  });
});
