import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  buildToolDefinitions,
  registerTool,
  toolRegistry,
} from '../src/tools/index.js';
import { TOOL_NAMES } from '../src/anthropic/tools.js';
import { createFinding } from '../src/domain/findings.js';
import { runVerificationLoop } from '../src/orchestrator/orchestrator.js';
import {
  SAMPLE_BATCH,
  invoiceDoc,
  sampleProvenance,
  scriptedAnthropic,
  silentLogger,
  toolUseMessage,
} from './helpers.js';

const ctx = () => ({
  batchId: SAMPLE_BATCH,
  provenance: sampleProvenance(),
  documents: [invoiceDoc()],
});

const deps = (anthropic: ReturnType<typeof scriptedAnthropic>) => ({
  anthropic,
  logger: silentLogger(),
  model: 'm',
  maxTokens: 1_024,
  maxIterations: 10,
  timeoutMs: 60_000,
});

describe('tool registry (builtins)', () => {
  it('advertises the four builtin tools first, in canonical order', () => {
    // The builtins register first; Fill-agent capability tools follow. Assert
    // the canonical builtin prefix rather than an exact list so the registry
    // stays open for extension (see the sibling parser/check/risk registries).
    expect(buildToolDefinitions().slice(0, 4).map((d) => d.name)).toEqual([
      TOOL_NAMES.getProvenance,
      TOOL_NAMES.parseDocument,
      TOOL_NAMES.recordFinding,
      TOOL_NAMES.finalizeVerdict,
    ]);
  });

  it('looks up tools by name', () => {
    expect(toolRegistry.get(TOOL_NAMES.recordFinding)).toBeDefined();
    expect(toolRegistry.get('no_such_tool')).toBeUndefined();
  });

  it('dispatches a Fill-agent tool through the loop', async () => {
    registerTool({
      name: 'note',
      definition: {
        name: 'note',
        description: 'Attach a note as an info finding.',
        input_schema: {
          type: 'object',
          properties: { text: { type: 'string' } },
          required: ['text'],
          additionalProperties: false,
        },
      },
      inputSchema: z.object({ text: z.string() }),
      handle: (input, _c, state) => ({
        content: { noted: true },
        patch: {
          findings: [...state.findings, createFinding('NOTE', 'info', input.text)],
        },
      }),
    });

    const anthropic = scriptedAnthropic([
      toolUseMessage({ id: 'n', name: 'note', input: { text: 'hello' } }),
      toolUseMessage({
        id: 'f',
        name: TOOL_NAMES.finalizeVerdict,
        input: { score: 9_000, summary: 'ok' },
      }),
    ]);

    const result = await runVerificationLoop(deps(anthropic), ctx());
    expect(result.findings.map((f) => f.code)).toContain('NOTE');
    expect(result.modelScore).toBe(9_000);
  });

  it('returns a tool error (not a crash) for an unknown tool name', async () => {
    const anthropic = scriptedAnthropic([
      toolUseMessage({ id: 'g', name: 'ghost_tool', input: {} }),
      toolUseMessage({
        id: 'f',
        name: TOOL_NAMES.finalizeVerdict,
        input: { score: 8_000, summary: 'done' },
      }),
    ]);
    const result = await runVerificationLoop(deps(anthropic), ctx());
    expect(result.modelScore).toBe(8_000);
    expect(result.findings).toHaveLength(0);
  });
});
