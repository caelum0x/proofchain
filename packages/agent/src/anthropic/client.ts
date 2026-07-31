/**
 * Anthropic client interface (injectable/mockable).
 *
 * The rest of the app depends on THIS interface, never on `@anthropic-ai/sdk`
 * directly, so tests can supply a scripted mock and run with no API key and no
 * network. The normalized message shape below is intentionally a small subset
 * of the real SDK response — just what the orchestrator needs.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

export type ContentBlock = TextBlock | ToolUseBlock;

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type MessageParamContent =
  | string
  | Array<TextBlock | ToolUseBlock | ToolResultBlock>;

export interface MessageParam {
  role: 'user' | 'assistant';
  content: MessageParamContent;
}

export interface CreateMessageParams {
  model: string;
  maxTokens: number;
  system?: string;
  messages: MessageParam[];
  tools?: ToolDefinition[];
}

export type StopReason =
  | 'end_turn'
  | 'tool_use'
  | 'max_tokens'
  | 'stop_sequence'
  | 'pause_turn'
  | 'refusal'
  | string;

export interface NormalizedMessage {
  stopReason: StopReason;
  content: ContentBlock[];
}

export interface AnthropicClient {
  createMessage(params: CreateMessageParams): Promise<NormalizedMessage>;
}
