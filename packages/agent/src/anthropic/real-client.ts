/**
 * Production AnthropicClient backed by `@anthropic-ai/sdk`. This is the ONLY
 * module that imports the SDK; everything else depends on the AnthropicClient
 * interface so it can be mocked in tests.
 */
import Anthropic from '@anthropic-ai/sdk';
import { modelError } from '../errors.js';
import type {
  AnthropicClient,
  ContentBlock,
  CreateMessageParams,
  NormalizedMessage,
} from './client.js';

export const createAnthropicClient = (apiKey: string): AnthropicClient => {
  const sdk = new Anthropic({ apiKey });

  return {
    async createMessage(params: CreateMessageParams): Promise<NormalizedMessage> {
      try {
        // Map our internal shapes onto the SDK's input types field-by-field so
        // TypeScript verifies structural compatibility at this boundary (a
        // single narrowing assertion), instead of the opaque `as unknown as`.
        const sdkMessages: Anthropic.MessageParam[] = params.messages.map(
          (m) => ({ role: m.role, content: m.content }),
        );
        const sdkTools: Anthropic.Tool[] | undefined = params.tools?.map(
          (t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.input_schema,
          }),
        );

        const response = await sdk.messages.create({
          model: params.model,
          max_tokens: params.maxTokens,
          ...(params.system !== undefined ? { system: params.system } : {}),
          messages: sdkMessages,
          ...(sdkTools !== undefined ? { tools: sdkTools } : {}),
        });

        const content: ContentBlock[] = [];
        for (const block of response.content) {
          if (block.type === 'text') {
            content.push({ type: 'text', text: block.text });
          } else if (block.type === 'tool_use') {
            content.push({
              type: 'tool_use',
              id: block.id,
              name: block.name,
              input: block.input,
            });
          }
        }

        return {
          stopReason: response.stop_reason ?? 'end_turn',
          content,
        };
      } catch (err) {
        if (err instanceof Anthropic.APIError) {
          throw modelError(`Anthropic API error (${err.status ?? 'unknown'})`, {
            type: err.name,
          });
        }
        throw modelError('Anthropic request failed', {
          cause: (err as Error).message,
        });
      }
    },
  };
};
