/**
 * Document parser service.
 *
 * `DocumentParser` (this service) turns a raw supplied document into structured
 * fields using Claude vision to extract JSON. Classification and per-doc-type
 * field validation are delegated to the PARSER REGISTRY (src/parsers), so new
 * document types are added by dropping in a parser file — never by editing this
 * service. All model output is validated with zod before use.
 */
import { modelError, errorMessage } from '../errors.js';
import { DOCUMENT_FETCH_TIMEOUT_MS } from '../config/constants.js';
import { sha256Hex } from '../util/hashing.js';
// Side-effect import: registers the builtin parsers (invoice, bol, generic).
import '../parsers/index.js';
import {
  documentTypes,
  parserFor,
  resolveDocType,
  type RawDocument,
} from '../parsers/registry.js';
import type { AnthropicClient, TextBlock } from './client.js';
import type { InputDocument, ParsedDocument } from '../domain/types.js';

export interface DocumentParser {
  parse(doc: InputDocument, index: number): Promise<ParsedDocument>;
}

const buildExtractionPrompt = (): string =>
  'You are a document extraction engine for shipment paperwork. Classify the ' +
  `document type (one of: ${documentTypes().join(', ')}) and extract fields. ` +
  'Respond with ONLY a single JSON object matching this shape (omit unknown ' +
  'fields): {"docType":string,"total":number,"currency":string,"lineItems":' +
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

/** The model's declared docType, if it supplied a usable string. */
const declaredDocType = (raw: unknown): string | undefined => {
  if (typeof raw === 'object' && raw !== null && 'docType' in raw) {
    const value = (raw as { docType: unknown }).docType;
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
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

/** UTF-8 body when the document is textual; undefined for binary. */
const textualBody = (doc: InputDocument, bytes: Uint8Array): string | undefined => {
  const isTextual =
    doc.mimeType.startsWith('text/') ||
    doc.mimeType === 'application/json' ||
    doc.mimeType === 'application/xml';
  if (!isTextual) return undefined;
  return Buffer.from(bytes).toString('utf8').slice(0, 20_000);
};

const buildUserText = (
  doc: InputDocument,
  body: string | undefined,
  byteLength: number,
): string => {
  const prompt = buildExtractionPrompt();
  if (body !== undefined) {
    return `${prompt}\n\nDocument name: ${doc.name}\n---\n${body}`;
  }
  return (
    `${prompt}\n\nDocument name: ${doc.name} (binary ${doc.mimeType}, ` +
    `${byteLength} bytes). Extract any fields legible from metadata.`
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
    const body = textualBody(doc, bytes);

    const message = await client.createMessage({
      model,
      maxTokens,
      messages: [
        { role: 'user', content: buildUserText(doc, body, bytes.byteLength) },
      ],
    });

    const text = message.content
      .filter((b): b is TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    const raw = extractJsonObject(text);

    // Classify via the registry (honour the model's type when registered, else
    // detect), then validate against that doc type's schema.
    const rawDoc: RawDocument = {
      name: doc.name,
      mimeType: doc.mimeType,
      ...(body !== undefined ? { text: body } : {}),
      sizeBytes: bytes.byteLength,
    };
    const docType = resolveDocType(declaredDocType(raw), rawDoc);
    const parser = parserFor(docType);

    const parsed = parser.schema.safeParse(raw);
    if (!parsed.success) {
      throw modelError('Document parser output failed validation', {
        issues: parsed.error.issues,
      });
    }

    return {
      index,
      name: doc.name,
      docType,
      fields: parsed.data,
      sha256,
    };
  },
});
