/**
 * The Claude tool-calling verification loop.
 *
 * The model drives verification through four tools (get_provenance,
 * parse_document, record_finding, finalize_verdict). The orchestrator owns the
 * control flow and enforces hard safety rails:
 *   - a wall-clock TIMEOUT (fails with ORCHESTRATION_TIMEOUT), and
 *   - a MAX ITERATION count (fails CLOSED: an unfinished analysis yields a
 *     strict score of 0 so a shipment is never waved through by exhaustion).
 * All model tool inputs are validated with zod before use.
 */
import { AppError } from '../errors.js';
import { createFinding } from '../domain/findings.js';
// Side-effect import: registers the four builtin tools into the tool registry.
import '../tools/index.js';
import { buildToolDefinitions, toolRegistry } from '../tools/registry.js';
import { documentDigest, provenanceSummary } from '../tools/context.js';
import type {
  AnthropicClient,
  MessageParam,
  ToolResultBlock,
  ToolUseBlock,
} from '../anthropic/client.js';
import type { Logger } from '../logger.js';
import type { Finding } from '../shared.js';
import type {
  OrchestratorResult,
  ParsedDocument,
  ProvenanceData,
} from '../domain/types.js';

export interface OrchestratorDeps {
  anthropic: AnthropicClient;
  logger: Logger;
  model: string;
  maxTokens: number;
  maxIterations: number;
  timeoutMs: number;
  /** Injectable clock for deterministic timeout tests. */
  now?: () => number;
}

export interface OrchestratorContext {
  batchId: string;
  provenance: ProvenanceData;
  documents: ParsedDocument[];
}

const SYSTEM_PROMPT =
  'You are ProofChain, an autonomous supply-chain verification agent. Inspect ' +
  'the shipment documents and cross-check them against the on-chain provenance ' +
  'trail. Use get_provenance to read the chain, parse_document to read each ' +
  'supplied document, and record_finding for every anomaly (invoice/total ' +
  'mismatches, quantity mismatches, party mismatches, missing or inconsistent ' +
  'provenance, origin-hash mismatches). When finished, call finalize_verdict ' +
  'with a risk score in basis points (0..10000, higher = cleaner) and a short ' +
  'summary. Be conservative: use critical severity only for provenance-breaking ' +
  'fraud. Do not fabricate findings.';

const toolResult = (
  id: string,
  content: unknown,
  isError = false,
): ToolResultBlock => ({
  type: 'tool_result',
  tool_use_id: id,
  content: typeof content === 'string' ? content : JSON.stringify(content),
  ...(isError ? { is_error: true } : {}),
});

interface LoopState {
  findings: Finding[];
  finalized: boolean;
  modelScore: number;
  summary: string;
  toolCalls: number;
}

interface ToolOutcome {
  result: ToolResultBlock;
  state: LoopState;
}

/**
 * Dispatch a single tool_use block PURELY through the tool REGISTRY: returns the
 * tool_result to feed back to the model plus the NEXT loop state (never mutates
 * its input). Each iteration's state transition stays explicit and referentially
 * transparent. Unknown tools and zod validation failures are returned to the
 * model as tool errors (is_error) so it can correct — they never crash the loop.
 */
const handleToolUse = (
  block: ToolUseBlock,
  ctx: OrchestratorContext,
  state: LoopState,
): ToolOutcome => {
  const next: LoopState = { ...state, toolCalls: state.toolCalls + 1 };

  const tool = toolRegistry.get(block.name);
  if (tool === undefined) {
    return {
      result: toolResult(block.id, `Unknown tool: ${block.name}`, true),
      state: next,
    };
  }

  const parsed = tool.inputSchema.safeParse(block.input);
  if (!parsed.success) {
    return {
      result: toolResult(block.id, `Invalid ${block.name} input`, true),
      state: next,
    };
  }

  const exec = tool.handle(parsed.data, ctx, next);
  // Merge the immutable patch; `findings` is readonly on ToolLoopState, so the
  // assertion re-narrows the spread result back to the mutable LoopState shape.
  const patchedState = (
    exec.patch !== undefined ? { ...next, ...exec.patch } : next
  ) as LoopState;
  return {
    result: toolResult(block.id, exec.content, exec.isError ?? false),
    state: patchedState,
  };
};

export const runVerificationLoop = async (
  deps: OrchestratorDeps,
  ctx: OrchestratorContext,
): Promise<OrchestratorResult> => {
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const tools = buildToolDefinitions();
  let state: LoopState = {
    findings: [],
    finalized: false,
    modelScore: 0,
    summary: '',
    toolCalls: 0,
  };

  const messages: MessageParam[] = [
    {
      role: 'user',
      content:
        `Verify batch ${ctx.batchId}.\n` +
        `On-chain provenance (summary): ${JSON.stringify(provenanceSummary(ctx.provenance))}\n` +
        `Available documents: ${JSON.stringify(documentDigest(ctx.documents))}\n` +
        'Inspect them and finalize a verdict.',
    },
  ];

  let iterations = 0;
  while (iterations < deps.maxIterations) {
    if (now() - startedAt > deps.timeoutMs) {
      throw new AppError(
        'ORCHESTRATION_TIMEOUT',
        `Verification exceeded ${deps.timeoutMs}ms`,
      );
    }
    iterations += 1;

    const message = await deps.anthropic.createMessage({
      model: deps.model,
      maxTokens: deps.maxTokens,
      system: SYSTEM_PROMPT,
      messages,
      tools,
    });

    const toolUses = message.content.filter(
      (b): b is ToolUseBlock => b.type === 'tool_use',
    );

    // Preserve the assistant turn (incl. tool_use) for the next request.
    messages.push({ role: 'assistant', content: message.content });

    if (toolUses.length === 0) {
      // The model produced only text without finalizing — fail closed.
      deps.logger.warn(
        { batchId: ctx.batchId, iterations },
        'Model ended turn without finalizing; failing closed',
      );
      break;
    }

    const results: ToolResultBlock[] = [];
    for (const block of toolUses) {
      const outcome = handleToolUse(block, ctx, state);
      results.push(outcome.result);
      state = outcome.state;
    }
    messages.push({ role: 'user', content: results });

    if (state.finalized) {
      return {
        modelScore: state.modelScore,
        summary: state.summary,
        findings: state.findings,
        iterations,
        toolCalls: state.toolCalls,
      };
    }
  }

  if (state.finalized) {
    return {
      modelScore: state.modelScore,
      summary: state.summary,
      findings: state.findings,
      iterations,
      toolCalls: state.toolCalls,
    };
  }

  // Exhausted iterations (or the model gave up) without a verdict: fail closed.
  deps.logger.warn(
    { batchId: ctx.batchId, iterations },
    'Verification loop ended without finalize_verdict; failing closed (score 0)',
  );
  return {
    modelScore: 0,
    summary:
      'Verification did not complete: the model did not finalize a verdict ' +
      'within the allowed iterations. Failing closed with a strict score.',
    findings: [
      ...state.findings,
      createFinding(
        'INCOMPLETE_VERIFICATION',
        'high',
        'The verification loop ended without a finalized verdict.',
        { iterations },
      ),
    ],
    iterations,
    toolCalls: state.toolCalls,
  };
};
