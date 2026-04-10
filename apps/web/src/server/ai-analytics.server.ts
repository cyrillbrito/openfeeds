import type { ChatMiddleware } from '@tanstack/ai';

/**
 * PostHog LLM analytics middleware for TanStack AI.
 *
 * Captures `$ai_generation` events with full trace data:
 * input/output messages, token usage, latency, tool calls, and errors.
 *
 * Uses `ctx.defer()` so analytics capture never blocks the stream.
 */
export function createAnalyticsMiddleware(userId: string): ChatMiddleware {
  // Collect tool calls across the entire run
  const toolCalls: Array<{ name: string; duration: number; ok: boolean }> = [];

  return {
    name: 'posthog-llm-analytics',

    onAfterToolCall(_ctx, info) {
      toolCalls.push({
        name: info.toolName,
        duration: info.duration,
        ok: info.ok,
      });
    },

    onFinish(ctx, info) {
      ctx.defer(
        captureGeneration({
          userId,
          model: ctx.model,
          provider: ctx.provider,
          traceId: ctx.conversationId ?? ctx.requestId,
          messages: ctx.messages,
          content: info.content,
          finishReason: info.finishReason,
          duration: info.duration,
          usage: info.usage,
          toolNames: ctx.toolNames,
          toolCalls,
          isError: false,
        }),
      );
    },

    onError(ctx, info) {
      ctx.defer(
        captureGeneration({
          userId,
          model: ctx.model,
          provider: ctx.provider,
          traceId: ctx.conversationId ?? ctx.requestId,
          messages: ctx.messages,
          content: '',
          finishReason: null,
          duration: info.duration,
          usage: undefined,
          toolNames: ctx.toolNames,
          toolCalls,
          isError: true,
          error: info.error,
        }),
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

interface GenerationData {
  userId: string;
  model: string;
  provider: string;
  traceId: string;
  messages: ReadonlyArray<{ role: string; content?: unknown }>;
  content: string;
  finishReason: string | null;
  duration: number;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  toolNames?: string[];
  toolCalls: Array<{ name: string; duration: number; ok: boolean }>;
  isError: boolean;
  error?: unknown;
}

async function captureGeneration(data: GenerationData): Promise<void> {
  const { posthog } = await import('@repo/domain');
  if (!posthog) return;

  const inputMessages = data.messages
    .filter((m) => m.role !== 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));

  const outputChoices = data.content
    ? [{ role: 'assistant', content: data.content }]
    : [];

  posthog.capture({
    distinctId: data.userId,
    event: '$ai_generation',
    properties: {
      $ai_trace_id: data.traceId,
      $ai_model: data.model,
      $ai_provider: data.provider,
      $ai_input: inputMessages,
      $ai_output_choices: outputChoices,
      $ai_input_tokens: data.usage?.promptTokens,
      $ai_output_tokens: data.usage?.completionTokens,
      $ai_latency: data.duration / 1000, // PostHog expects seconds
      $ai_stream: true,
      $ai_max_tokens: 4096,
      $ai_is_error: data.isError,
      ...(data.error != null
        ? { $ai_error: data.error instanceof Error ? data.error.message : JSON.stringify(data.error) }
        : {}),
      ...(data.toolNames != null
        ? {
            $ai_tools: data.toolNames.map((name) => ({
              type: 'function',
              function: { name, parameters: {} },
            })),
          }
        : {}),
      // Custom properties for our own dashboards
      tool_calls: data.toolCalls,
      finish_reason: data.finishReason,
    },
  });
}
