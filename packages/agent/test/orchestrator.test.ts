import { describe, expect, it } from 'vitest';
import { runVerificationLoop } from '../src/orchestrator/orchestrator.js';
import { TOOL_NAMES } from '../src/anthropic/tools.js';
import { AppError } from '../src/errors.js';
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

describe('runVerificationLoop', () => {
  it('drives tools then finalizes with the model score', async () => {
    const anthropic = scriptedAnthropic([
      toolUseMessage({
        id: 't1',
        name: TOOL_NAMES.getProvenance,
        input: { batchId: SAMPLE_BATCH },
      }),
      toolUseMessage({
        id: 't2',
        name: TOOL_NAMES.parseDocument,
        input: { index: 0 },
      }),
      toolUseMessage({
        id: 't3',
        name: TOOL_NAMES.recordFinding,
        input: { code: 'MODEL_NOTE', severity: 'low', message: 'noted' },
      }),
      toolUseMessage({
        id: 't4',
        name: TOOL_NAMES.finalizeVerdict,
        input: { score: 9_200, summary: 'clean' },
      }),
    ]);

    const result = await runVerificationLoop(
      {
        anthropic,
        logger: silentLogger(),
        model: 'claude-opus-4-8',
        maxTokens: 1_024,
        maxIterations: 10,
        timeoutMs: 60_000,
      },
      ctx(),
    );

    expect(result.modelScore).toBe(9_200);
    expect(result.summary).toBe('clean');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.code).toBe('MODEL_NOTE');
    expect(result.toolCalls).toBe(4);
  });

  it('fails closed (score 0) when iterations are exhausted without finalize', async () => {
    const anthropic = scriptedAnthropic([
      toolUseMessage({
        id: 'a',
        name: TOOL_NAMES.recordFinding,
        input: { code: 'A', severity: 'low', message: 'x' },
      }),
      toolUseMessage({
        id: 'b',
        name: TOOL_NAMES.recordFinding,
        input: { code: 'B', severity: 'low', message: 'y' },
      }),
    ]);

    const result = await runVerificationLoop(
      {
        anthropic,
        logger: silentLogger(),
        model: 'm',
        maxTokens: 1_024,
        maxIterations: 2,
        timeoutMs: 60_000,
      },
      ctx(),
    );

    expect(result.modelScore).toBe(0);
    expect(result.findings.map((f) => f.code)).toContain('INCOMPLETE_VERIFICATION');
  });

  it('fails closed when the model ends its turn with only text', async () => {
    const anthropic = scriptedAnthropic([
      { stopReason: 'end_turn', content: [{ type: 'text', text: 'I refuse' }] },
    ]);
    const result = await runVerificationLoop(
      {
        anthropic,
        logger: silentLogger(),
        model: 'm',
        maxTokens: 1_024,
        maxIterations: 5,
        timeoutMs: 60_000,
      },
      ctx(),
    );
    expect(result.modelScore).toBe(0);
  });

  it('throws ORCHESTRATION_TIMEOUT when wall-clock is exceeded', async () => {
    const clock = [0, 0, 1_000_000];
    let i = 0;
    const now = () => clock[Math.min(i++, clock.length - 1)] ?? 1_000_000;

    const anthropic = scriptedAnthropic([
      toolUseMessage({
        id: 'x',
        name: TOOL_NAMES.recordFinding,
        input: { code: 'X', severity: 'low', message: 'x' },
      }),
    ]);

    await expect(
      runVerificationLoop(
        {
          anthropic,
          logger: silentLogger(),
          model: 'm',
          maxTokens: 1_024,
          maxIterations: 10,
          timeoutMs: 1_000,
          now,
        },
        ctx(),
      ),
    ).rejects.toMatchObject({ code: 'ORCHESTRATION_TIMEOUT' } as Partial<AppError>);
  });

  it('returns a tool error (not a crash) for invalid model tool input', async () => {
    const anthropic = scriptedAnthropic([
      toolUseMessage({
        id: 'bad',
        name: TOOL_NAMES.recordFinding,
        input: { code: 'lowercase-bad', severity: 'nope', message: '' },
      }),
      toolUseMessage({
        id: 'fin',
        name: TOOL_NAMES.finalizeVerdict,
        input: { score: 8_000, summary: 'done' },
      }),
    ]);
    const result = await runVerificationLoop(
      {
        anthropic,
        logger: silentLogger(),
        model: 'm',
        maxTokens: 1_024,
        maxIterations: 5,
        timeoutMs: 60_000,
      },
      ctx(),
    );
    // invalid finding was rejected, so it is NOT recorded
    expect(result.findings).toHaveLength(0);
    expect(result.modelScore).toBe(8_000);
  });
});
