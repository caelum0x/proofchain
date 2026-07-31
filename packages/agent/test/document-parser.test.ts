import { describe, expect, it } from 'vitest';
import { createClaudeDocumentParser } from '../src/anthropic/document-parser.js';
import { AppError } from '../src/errors.js';
import { scriptedAnthropic, textMessage } from './helpers.js';
import type { InputDocument } from '../src/domain/types.js';

const b64 = (s: string): string => Buffer.from(s).toString('base64');

const textDoc = (): InputDocument => ({
  name: 'invoice.txt',
  mimeType: 'text/plain',
  dataBase64: b64('Invoice total 1000 USD'),
});

describe('createClaudeDocumentParser', () => {
  it('extracts structured fields from the model JSON and hashes the bytes', async () => {
    const anthropic = scriptedAnthropic([
      textMessage(
        JSON.stringify({
          docType: 'invoice',
          total: 1_000,
          currency: 'USD',
          lineItems: [
            { description: 'w', quantity: 10, unitPrice: 100, amount: 1_000 },
          ],
          supplierName: 'Acme',
        }),
      ),
    ]);
    const parser = createClaudeDocumentParser(anthropic, 'm', 1_024);
    const parsed = await parser.parse(textDoc(), 3);

    expect(parsed.index).toBe(3);
    expect(parsed.docType).toBe('invoice');
    expect(parsed.fields.total).toBe(1_000);
    expect(parsed.fields.supplierName).toBe('Acme');
    expect(parsed.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('tolerates prose around the JSON object', async () => {
    const anthropic = scriptedAnthropic([
      textMessage('Here you go:\n{"docType":"unknown","quantity":5}\nDone.'),
    ]);
    const parser = createClaudeDocumentParser(anthropic, 'm', 1_024);
    const parsed = await parser.parse(textDoc(), 0);
    expect(parsed.fields.quantity).toBe(5);
    expect(parsed.docType).toBe('unknown');
  });

  it('throws MODEL_ERROR when no JSON object is present', async () => {
    const anthropic = scriptedAnthropic([textMessage('no json here')]);
    const parser = createClaudeDocumentParser(anthropic, 'm', 1_024);
    await expect(parser.parse(textDoc(), 0)).rejects.toBeInstanceOf(AppError);
  });

  it('throws MODEL_ERROR when the JSON fails field validation', async () => {
    const anthropic = scriptedAnthropic([
      textMessage(JSON.stringify({ total: 'not-a-number' })),
    ]);
    const parser = createClaudeDocumentParser(anthropic, 'm', 1_024);
    await expect(parser.parse(textDoc(), 0)).rejects.toBeInstanceOf(AppError);
  });

  it('throws when a document has neither dataBase64 nor url', async () => {
    const anthropic = scriptedAnthropic([textMessage('{}')]);
    const parser = createClaudeDocumentParser(anthropic, 'm', 1_024);
    await expect(
      parser.parse({ name: 'x', mimeType: 'text/plain' }, 0),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('produces a stable sha256 for identical bytes', async () => {
    const parser = createClaudeDocumentParser(
      scriptedAnthropic([textMessage('{}'), textMessage('{}')]),
      'm',
      1_024,
    );
    const a = await parser.parse(textDoc(), 0);
    const b = await parser.parse(textDoc(), 1);
    expect(a.sha256).toBe(b.sha256);
  });
});
