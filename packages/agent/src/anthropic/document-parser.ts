/**
 * Document parser abstraction.
 *
 * `DocumentParser` turns a raw supplied document into structured fields. The
 * production implementation uses Claude vision (a cheap sub-step model) to
 * extract JSON; it is injected, so tests substitute a deterministic stub with
 * no network. All model output is validated with zod before use.
 */
import { z } from 'zod';
import { modelError, errorMessage } from '../errors.js';
import { DOCUMENT_FETCH_TIMEOUT_MS } from '../config/constants.js';
import { sha256Hex } from '../util/hashing.js';
import type { AnthropicClient, TextBlock } from './client.js';
import type {
  DocumentType,
  InputDocument,
  ParsedDocument,
  ParsedDocumentFields,
} from '../domain/types.js';

export interface DocumentParser {
  parse(doc: InputDocument, index: number): Promise<ParsedDocument>;
}

const lineItemSchema = z.object({
  description: z.string().default(''),
  quantity: z.number(),
  unitPrice: z.number(),
  amount: z.number(),
});

const fieldsSchema = z.object({
  docType: z.enum(['invoice', 'bill_of_lading', 'unknown']).default('unknown'),
  total: z.number().optional(),
  currency: z.string().optional(),
  lineItems: z.array(lineItemSchema).optional(),
  quantity: z.number().optional(),
  supplierName: z.string().optional(),
  buyerName: z.string().optional(),
  originHash: z.string().optional(),
  date: z.string().optional(),
  parties: z.array(z.string()).optional(),
});

const EXTRACTION_PROMPT =
  'You are a document extraction engine for shipment paperwork (invoices, ' +
  'bills of lading). Extract fields and respond with ONLY a single JSON object ' +
  'matching this shape (omit unknown fields): {"docType":"invoice"|' +
  '"bill_of_lading"|"unknown","total":number,"currency":string,"lineItems":' +
  '[{"description":string,"quantity":number,"unitPrice":number,"amount":number}]' +
  ',"quantity":number,"supplierName":string,"buyerName":string,"originHash":' +
  'string,"date":"ISO-8601","parties":[string]}. No prose, no code fences.';

const extractJsonObject = (text: string): unknown => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw modelError('Document parser returned no JSON object');
  }
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch (err) {
    throw modelError('Document parser returned invalid JSON', {
      cause: errorMessage(err),
    });
  }
};

const loadBytes = async (doc: InputDocument): Promise<Uint8Array> => {
  if (doc.dataBase64 !== undefined) {
    return new Uint8Array(Buffer.from(doc.dataBase64, 'base64'));
  }
  if (doc.url !== undefined) {
    let res: Response;
    try {
      // Bound the fetch so a slow/hanging upstream cannot stall the pipeline.
      res = await fetch(doc.url, {
        signal: AbortSignal.timeout(DOCUMENT_FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      throw modelError('Failed to fetch document', {
        url: doc.url,
        cause: errorMessage(err),
      });
    }
    if (!res.ok) {
      throw modelError(`Failed to fetch document (${res.status})`, {
        url: doc.url,
      });
    }
    return new Uint8Array(await res.arrayBuffer());
  }
  throw modelError('Document has neither dataBase64 nor url');
};

/**
 * Build the user content for the extraction request. Images/PDF go as native
 * blocks; text-ish documents are inlined. We keep this simple: the model is
 * asked for JSON regardless of input modality.
 */
const buildUserText = (doc: InputDocument, bytes: Uint8Array): string => {
  const isTextual =
    doc.mimeType.startsWith('text/') ||
    doc.mimeType === 'application/json' ||
    doc.mimeType === 'application/xml';
  if (isTextual) {
    const body = Buffer.from(bytes).toString('utf8').slice(0, 20_000);
    return `${EXTRACTION_PROMPT}\n\nDocument name: ${doc.name}\n---\n${body}`;
  }
  return (
    `${EXTRACTION_PROMPT}\n\nDocument name: ${doc.name} (binary ${doc.mimeType}, ` +
    `${bytes.byteLength} bytes). Extract any fields legible from metadata.`
  );
};

export const createClaudeDocumentParser = (
  client: AnthropicClient,
  model: string,
  maxTokens: number,
): DocumentParser => ({
  async parse(doc, index) {
    const bytes = await loadBytes(doc);
    const sha256 = sha256Hex(bytes);

    const message = await client.createMessage({
      model,
      maxTokens,
      messages: [{ role: 'user', content: buildUserText(doc, bytes) }],
    });

    const text = message.content
      .filter((b): b is TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    const parsed = fieldsSchema.safeParse(extractJsonObject(text));
    if (!parsed.success) {
      throw modelError('Document parser output failed validation', {
        issues: parsed.error.issues,
      });
    }

    const { docType, ...rest } = parsed.data;
    const fields: ParsedDocumentFields = rest;
    return {
      index,
      name: doc.name,
      docType: docType as DocumentType,
      fields,
      sha256,
    };
  },
});
