/**
 * `get_receivable` — construct the trade receivable implied by the shipment so
 * the model can reason about financing eligibility. It resolves the governing
 * invoice, then derives the receivable's face value, currency, debtor/creditor
 * and a verifiability status grounded in on-chain provenance.
 *
 * A seeded receivable (keyed by batchId) overrides the derivation — a real
 * deployment feeds terms from the ledger / Supabase.
 */
import { z } from 'zod';
import { createStore } from './support.js';
import { registerTool } from './registry.js';
import type { ParsedDocument } from '../domain/types.js';

const NAME = 'get_receivable';

export interface ReceivableRecord {
  readonly faceValue: number;
  readonly currency: string;
  readonly debtor?: string;
  readonly creditor?: string;
  readonly dueDate?: string;
}

/** Seedable receivable store keyed by batchId. */
export const receivableStore = createStore<ReceivableRecord>();

export const getReceivableInput = z
  .object({
    documentIndex: z.number().int().nonnegative().optional(),
  })
  .strict();

export type GetReceivableInput = z.infer<typeof getReceivableInput>;

const pickInvoice = (
  docs: readonly ParsedDocument[],
  index: number | undefined,
): ParsedDocument | undefined => {
  if (index !== undefined) return docs[index];
  return docs.find((d) => d.docType === 'invoice') ?? docs[0];
};

export const getReceivableTool = registerTool<GetReceivableInput>({
  name: NAME,
  definition: {
    name: NAME,
    description:
      'Build the trade receivable for this batch (face value, currency, ' +
      'debtor, creditor, due date, verifiability) from its invoice. Pass ' +
      '`documentIndex` to target a specific document.',
    input_schema: {
      type: 'object',
      properties: {
        documentIndex: {
          type: 'integer',
          description: 'Zero-based index of the invoice document to use.',
        },
      },
      additionalProperties: false,
    },
  },
  inputSchema: getReceivableInput,
  handle: (input, ctx) => {
    const seeded = receivableStore.get(ctx.provenance.batchId);
    if (seeded !== undefined) {
      return {
        content: {
          batchId: ctx.provenance.batchId,
          source: 'seeded',
          faceValue: seeded.faceValue,
          currency: seeded.currency,
          debtor: seeded.debtor ?? null,
          creditor: seeded.creditor ?? null,
          dueDate: seeded.dueDate ?? null,
          status: ctx.provenance.exists ? 'verifiable' : 'unverified',
        },
      };
    }

    const doc = pickInvoice(ctx.documents, input.documentIndex);
    if (doc === undefined) {
      return {
        content: { error: 'No document available to derive a receivable.' },
        isError: true,
      };
    }
    const { total, currency, supplierName, buyerName, date } = doc.fields;
    if (total === undefined) {
      return {
        content: {
          error: `Document "${doc.name}" has no total; cannot derive a receivable.`,
          documentIndex: doc.index,
        },
        isError: true,
      };
    }

    return {
      content: {
        batchId: ctx.provenance.batchId,
        source: 'derived',
        documentIndex: doc.index,
        faceValue: total,
        currency: currency ?? 'USD',
        debtor: buyerName ?? null,
        creditor: supplierName ?? ctx.provenance.supplier,
        dueDate: date ?? null,
        status: ctx.provenance.exists ? 'verifiable' : 'unverified',
      },
    };
  },
});
