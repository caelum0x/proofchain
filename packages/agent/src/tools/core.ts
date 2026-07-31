/**
 * The four builtin tools that drive the base verification loop. Each wraps a
 * zod input schema (from anthropic/tools.ts) with a pure handler. Registering
 * them here is what makes the orchestrator's dispatch table data-driven — Fill
 * agents add capabilities by dropping in sibling files, never by editing the
 * loop.
 */
import { createFinding } from '../domain/findings.js';
import {
  finalizeVerdictInput,
  finalizeVerdictToolDef,
  getProvenanceInput,
  getProvenanceToolDef,
  parseDocumentInput,
  parseDocumentToolDef,
  recordFindingInput,
  recordFindingToolDef,
} from '../anthropic/tools.js';
import { provenanceSummary } from './context.js';
import { registerTool } from './registry.js';

export const getProvenanceTool = registerTool({
  name: getProvenanceToolDef.name,
  definition: getProvenanceToolDef,
  inputSchema: getProvenanceInput,
  handle: (_input, ctx) => ({ content: provenanceSummary(ctx.provenance) }),
});

export const parseDocumentTool = registerTool({
  name: parseDocumentToolDef.name,
  definition: parseDocumentToolDef,
  inputSchema: parseDocumentInput,
  handle: (input, ctx) => {
    const doc = ctx.documents[input.index];
    if (doc === undefined) {
      return { content: `No document at index ${input.index}`, isError: true };
    }
    return {
      content: {
        index: doc.index,
        name: doc.name,
        docType: doc.docType,
        sha256: doc.sha256,
        fields: doc.fields,
      },
    };
  },
});

export const recordFindingTool = registerTool({
  name: recordFindingToolDef.name,
  definition: recordFindingToolDef,
  inputSchema: recordFindingInput,
  handle: (input, _ctx, state) => {
    const finding = createFinding(
      input.code,
      input.severity,
      input.message,
      input.evidence,
    );
    return {
      content: { recorded: true },
      patch: { findings: [...state.findings, finding] },
    };
  },
});

export const finalizeVerdictTool = registerTool({
  name: finalizeVerdictToolDef.name,
  definition: finalizeVerdictToolDef,
  inputSchema: finalizeVerdictInput,
  handle: (input) => ({
    content: { accepted: true },
    patch: { finalized: true, modelScore: input.score, summary: input.summary },
  }),
});
