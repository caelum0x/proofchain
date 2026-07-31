/**
 * Tool definitions exposed to Claude inside the verification loop, plus zod
 * schemas to validate the model's tool inputs at the boundary (never trust
 * model output).
 */
import { z } from 'zod';
import { findingSchema, severitySchema } from '../domain/findings.js';
import { MAX_SCORE_BPS } from '../config/constants.js';
import type { ToolDefinition } from './client.js';

export const TOOL_NAMES = {
  getProvenance: 'get_provenance',
  parseDocument: 'parse_document',
  recordFinding: 'record_finding',
  finalizeVerdict: 'finalize_verdict',
} as const;

export const getProvenanceInput = z.object({
  batchId: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, 'batchId must be a 0x 32-byte hex string'),
});

export const parseDocumentInput = z.object({
  index: z.number().int().nonnegative(),
});

export const recordFindingInput = findingSchema;

export const finalizeVerdictInput = z.object({
  score: z.number().int().min(0).max(MAX_SCORE_BPS),
  summary: z.string().min(1).max(4_000),
});

export const getProvenanceToolDef: ToolDefinition = {
  name: TOOL_NAMES.getProvenance,
  description:
    'Fetch the on-chain provenance for a batch: supplier, origin hash, ' +
    'metadata URI, creation time, and the ordered checkpoint trail.',
  input_schema: {
    type: 'object',
    properties: {
      batchId: {
        type: 'string',
        description: '0x-prefixed 32-byte batch id.',
      },
    },
    required: ['batchId'],
    additionalProperties: false,
  },
};

export const parseDocumentToolDef: ToolDefinition = {
  name: TOOL_NAMES.parseDocument,
  description:
    'Return the structured fields extracted from a supplied document by ' +
    'its zero-based index (totals, line items, quantities, parties, dates).',
  input_schema: {
    type: 'object',
    properties: {
      index: {
        type: 'integer',
        description: 'Zero-based index into the supplied documents array.',
      },
    },
    required: ['index'],
    additionalProperties: false,
  },
};

export const recordFindingToolDef: ToolDefinition = {
  name: TOOL_NAMES.recordFinding,
  description:
    'Record a structured anomaly/finding. Call once per distinct issue. ' +
    'Use severity critical only for provenance-breaking fraud.',
  input_schema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'UPPER_SNAKE_CASE finding code, e.g. INVOICE_TOTAL_MISMATCH.',
      },
      severity: {
        type: 'string',
        enum: severitySchema.options,
        description: 'One of info, low, medium, high, critical.',
      },
      message: { type: 'string', description: 'Human-readable explanation.' },
      evidence: {
        type: 'object',
        description: 'Optional structured evidence for the finding.',
        additionalProperties: true,
      },
    },
    required: ['code', 'severity', 'message'],
    additionalProperties: false,
  },
};

export const finalizeVerdictToolDef: ToolDefinition = {
  name: TOOL_NAMES.finalizeVerdict,
  description:
    'End the verification. Provide a final risk score in basis points ' +
    '(0..10000, higher is cleaner) and a short summary of the reasoning.',
  input_schema: {
    type: 'object',
    properties: {
      score: {
        type: 'integer',
        description: 'Final score in basis points, 0..10000.',
      },
      summary: { type: 'string', description: 'Short verdict summary.' },
    },
    required: ['score', 'summary'],
    additionalProperties: false,
  },
};

/**
 * The four builtin tool definitions in canonical order. NOTE: the orchestrator
 * now sources tool definitions from the tool REGISTRY (src/tools/registry.ts);
 * this helper is retained for direct/legacy use and tests.
 */
export const buildToolDefinitions = (): ToolDefinition[] => [
  getProvenanceToolDef,
  parseDocumentToolDef,
  recordFindingToolDef,
  finalizeVerdictToolDef,
];
