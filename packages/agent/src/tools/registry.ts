/**
 * Agent tool registry.
 *
 * Each `AgentTool` is one capability the Claude tool-calling loop can invoke:
 * a JSON-schema `definition` sent to the model, a zod `inputSchema` that
 * validates the model's arguments at the boundary (never trust model output),
 * and a pure `handle` that produces the tool result plus an optional loop-state
 * patch. The orchestrator dispatches ENTIRELY through this registry — there is
 * no hard-coded switch statement.
 *
 * REGISTRATION CONVENTION
 *   Create `src/tools/<tool>.ts` that builds an `AgentTool` and calls
 *   `registerTool(...)`, then append a side-effect import to
 *   `src/tools/index.ts`. Never edit this file.
 */
import { z } from 'zod';
import { createRegistry } from '../registry/registry.js';
import type { ToolDefinition } from '../anthropic/client.js';
import type { Finding } from '../shared.js';
import type { ParsedDocument, ProvenanceData } from '../domain/types.js';

/** What a tool may read about the batch under verification. */
export interface ToolHandlerContext {
  readonly batchId: string;
  readonly provenance: ProvenanceData;
  readonly documents: readonly ParsedDocument[];
}

/** The mutable-by-copy loop state a tool may contribute to. */
export interface ToolLoopState {
  readonly findings: readonly Finding[];
  readonly finalized: boolean;
  readonly modelScore: number;
  readonly summary: string;
}

export interface ToolExecutionResult {
  /** Payload returned to the model as the tool_result content. */
  readonly content: unknown;
  /** Marks the tool_result as an error the model should react to. */
  readonly isError?: boolean;
  /** Immutable patch merged into the loop state after this tool runs. */
  readonly patch?: Partial<ToolLoopState>;
}

export interface AgentTool<Input = unknown> {
  /** Unique tool name AND registry key, e.g. "get_provenance". */
  readonly name: string;
  /** The definition advertised to the model. */
  readonly definition: ToolDefinition;
  /** Validates the model-supplied arguments. */
  readonly inputSchema: z.ZodType<Input>;
  /** Pure handler: returns the result + optional state patch. */
  handle(
    input: Input,
    ctx: ToolHandlerContext,
    state: ToolLoopState,
  ): ToolExecutionResult;
}

export const toolRegistry = createRegistry<AgentTool>({
  label: 'agent-tool',
  keyOf: (t) => t.name,
});

/** Register a tool (called by each `src/tools/<tool>.ts` module). */
export const registerTool = <Input>(tool: AgentTool<Input>): AgentTool<Input> =>
  toolRegistry.register(tool as AgentTool) as AgentTool<Input>;

/** The tool definitions advertised to the model, in registration order. */
export const buildToolDefinitions = (): ToolDefinition[] =>
  toolRegistry.all().map((t) => t.definition);
