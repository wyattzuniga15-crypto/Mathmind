import { AppError, toAppError } from '../errors';
import { createId } from '../sse';
import type {
  StreamEvent,
  SubjectModule,
  SubjectTool,
  ToolCallRecord,
  ToolExecutionContext,
  ToolResultPayload,
} from '../types';
import type { AiClient, ApiMessage, ContentBlock } from './client';

export interface AgentRunOptions {
  client: AiClient;
  subject: SubjectModule;
  system: string;
  messages: ApiMessage[];
  model: string;
  maxTokens: number;
  maxIterations: number;
  context: ToolExecutionContext;
  signal?: AbortSignal;
  /**
   * Schemas to advertise upstream. Defaults to every tool the subject has.
   * Narrowing this saves tokens on each call; it never limits what can run,
   * because dispatch below still uses the subject's full tool list.
   */
  advertisedTools?: SubjectTool[];
}

/**
 * Runs a full assistant turn: stream text, execute any deterministic tool calls
 * locally, feed the results back, and continue until the model stops asking for
 * tools. Every tool call and result is emitted so the UI can show the working.
 */
export async function* runAgent(options: AgentRunOptions): AsyncGenerator<StreamEvent> {
  const { client, subject, system, model, maxTokens, maxIterations, context, signal } = options;
  const toolMap = new Map(subject.tools.map((t) => [t.definition.name, t]));
  const toolDefs = (options.advertisedTools ?? subject.tools).map((t) => t.definition);
  const conversation: ApiMessage[] = [...options.messages];
  const messageId = createId('msg');
  const allToolCalls: ToolCallRecord[] = [];
  const usage = { inputTokens: 0, outputTokens: 0 };

  yield { type: 'start', messageId, model };

  try {
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      if (signal?.aborted) throw new AppError('aborted', 'Generation was stopped.', { status: 499 });

      let turn: Awaited<ReturnType<AiClient['complete']>> | null = null;

      for await (const event of client.stream({
        model,
        system,
        messages: conversation,
        tools: toolDefs.length ? toolDefs : undefined,
        maxTokens,
        signal,
      })) {
        if (event.type === 'text_delta') {
          yield { type: 'text', delta: event.text };
        } else if (event.type === 'turn_complete') {
          turn = event.turn;
        }
      }

      if (!turn) throw new AppError('upstream_error', 'The AI service ended the stream unexpectedly.');
      usage.inputTokens += turn.usage.inputTokens;
      usage.outputTokens += turn.usage.outputTokens;

      const toolUses = turn.content.filter(
        (b): b is Extract<ContentBlock, { type: 'tool_use' }> => b.type === 'tool_use',
      );

      if (turn.stopReason !== 'tool_use' || toolUses.length === 0) {
        // A turn with no text and no tool calls would render as a blank reply.
        // Say so explicitly instead: a silent failure is impossible to debug.
        const producedText = turn.content.some(
          (b) => b.type === 'text' && b.text.trim().length > 0,
        );
        if (!producedText && allToolCalls.length === 0) {
          yield {
            type: 'error',
            message: `The AI provider returned an empty response (stop reason: ${turn.stopReason ?? 'none'}). This usually means the configured model does not support tool calling, or the request was filtered. Check the model ID in your environment variables.`,
            code: 'upstream_error',
            retryable: true,
          };
          return;
        }
        yield { type: 'done', usage, stopReason: turn.stopReason, toolCalls: allToolCalls };
        return;
      }

      conversation.push({ role: 'assistant', content: turn.content });

      const results: ContentBlock[] = [];
      for (const use of toolUses) {
        const input = (use.input ?? {}) as Record<string, unknown>;
        yield { type: 'tool_call', id: use.id, name: use.name, input };

        const started = Date.now();
        let result: ToolResultPayload;
        const tool = toolMap.get(use.name);
        if (!tool) {
          result = { ok: false, error: `Unknown tool "${use.name}".` };
        } else {
          try {
            result = await tool.execute(input, context);
          } catch (err) {
            result = { ok: false, error: (err as Error).message || 'Tool execution failed.' };
          }
        }
        const durationMs = Date.now() - started;

        const record: ToolCallRecord = { id: use.id, name: use.name, input, result, durationMs };
        allToolCalls.push(record);
        yield { type: 'tool_result', id: use.id, name: use.name, result, durationMs };

        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: JSON.stringify(result.ok ? (result.data ?? {}) : { error: result.error }),
          is_error: !result.ok,
        });
      }

      conversation.push({ role: 'user', content: results });
    }

    // Exhausted the tool budget: ask for a final answer with tools disabled so
    // the student always gets a written response.
    const final = await client.complete({
      model,
      system: `${system}\n\nYou have used all available tool calls. Write your final answer now using the results you already have. Do not request more tools.`,
      messages: conversation,
      maxTokens,
      signal,
    });
    const text = final.content
      .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('');
    if (text) yield { type: 'text', delta: text };
    usage.inputTokens += final.usage.inputTokens;
    usage.outputTokens += final.usage.outputTokens;
    yield { type: 'done', usage, stopReason: final.stopReason, toolCalls: allToolCalls };
  } catch (err) {
    const appError = toAppError(err);
    yield {
      type: 'error',
      message: appError.message,
      code: appError.code,
      retryable: appError.retryable,
    };
  }
}
