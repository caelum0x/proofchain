/**
 * Shared test doubles: a scripted Anthropic client, a mock chain client, a stub
 * document parser, a silent logger, and a deterministic pinner. All run with NO
 * network and NO API key.
 */
import { vi } from 'vitest';
import { pino } from 'pino';
import type {
  AnthropicClient,
  ContentBlock,
  NormalizedMessage,
} from '../src/anthropic/client.js';
import type { DocumentParser } from '../src/anthropic/document-parser.js';
import type { ChainClient } from '../src/chain/client.js';
import type { Logger } from '../src/logger.js';
import type { VerdictPinner } from '../src/verdict/pinner.js';
import type {
  Hex,
  OnchainAttestation,
  ParsedDocument,
  ProvenanceData,
} from '../src/domain/types.js';

export const silentLogger = (): Logger => pino({ level: 'silent' });

export const localPinner = (): VerdictPinner => ({
  pinJson: async () => 'ipfs://mock/test',
});

export const AGENT_ADDRESS: Hex =
  '0x00000000000000000000000000000000000000a9';

export const SAMPLE_BATCH: Hex =
  '0x1234567890123456789012345678901234567890123456789012345678901234';

export const sampleProvenance = (
  overrides: Partial<ProvenanceData> = {},
): ProvenanceData => ({
  batchId: SAMPLE_BATCH,
  exists: true,
  supplier: '0x00000000000000000000000000000000000000b0',
  originHash:
    '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  metadataURI: 'ipfs://meta',
  createdAt: 1_700_000_000,
  checkpoints: [
    {
      location: 'Shenzhen',
      timestamp: 1_700_000_100,
      dataHash:
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
  ],
  ...overrides,
});

/** Build a scripted AnthropicClient that returns queued messages in order. */
export const scriptedAnthropic = (
  responses: NormalizedMessage[],
): AnthropicClient => {
  const queue = [...responses];
  return {
    createMessage: vi.fn(async () => {
      const next = queue.shift();
      if (next === undefined) {
        throw new Error('scriptedAnthropic exhausted');
      }
      return next;
    }),
  };
};

export const textMessage = (text: string): NormalizedMessage => ({
  stopReason: 'end_turn',
  content: [{ type: 'text', text }],
});

export const toolUseMessage = (
  ...blocks: Array<{ id: string; name: string; input: unknown }>
): NormalizedMessage => ({
  stopReason: 'tool_use',
  content: blocks.map(
    (b): ContentBlock => ({
      type: 'tool_use',
      id: b.id,
      name: b.name,
      input: b.input,
    }),
  ),
});

export const stubDocumentParser = (docs: ParsedDocument[]): DocumentParser => ({
  parse: vi.fn(async (_doc, index) => {
    const found = docs[index];
    if (found === undefined) throw new Error(`no stub doc at ${index}`);
    return found;
  }),
});

export interface MockChainOptions {
  provenance?: ProvenanceData;
  isAttested?: boolean;
  attestation?: OnchainAttestation | null;
  attestTxHash?: Hex;
  settleTxHash?: Hex;
}

export const mockChainClient = (opts: MockChainOptions = {}): ChainClient => ({
  agentAddress: AGENT_ADDRESS,
  getProvenance: vi.fn(async () => opts.provenance ?? sampleProvenance()),
  isAttested: vi.fn(async () => opts.isAttested ?? false),
  getAttestation: vi.fn(async () => opts.attestation ?? null),
  attest: vi.fn(async () => ({
    txHash:
      opts.attestTxHash ??
      ('0xdead000000000000000000000000000000000000000000000000000000000001' as Hex),
  })),
  settle: vi.fn(async () => ({
    txHash:
      opts.settleTxHash ??
      ('0xdead000000000000000000000000000000000000000000000000000000000002' as Hex),
  })),
});

export const invoiceDoc = (
  overrides: Partial<ParsedDocument> = {},
): ParsedDocument => ({
  index: 0,
  name: 'invoice.pdf',
  docType: 'invoice',
  sha256: 'a'.repeat(64),
  fields: {
    total: 1_000,
    currency: 'USD',
    lineItems: [
      { description: 'widget', quantity: 10, unitPrice: 100, amount: 1_000 },
    ],
    supplierName: 'Acme',
  },
  ...overrides,
});
