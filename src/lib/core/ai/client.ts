import { AppError } from '../errors';
import type { ToolDefinition } from '../types';

export type ContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: {
        type: 'base64';
        media_type: string;
        data: string;
      };
    }
  | {
      type: 'tool_use';
      id: string;
      name: string;
      input: unknown;
    }
  | {
      type: 'tool_result';
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    };

export interface ApiMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface CompletionRequest {
  model: string;
  system: string;
  messages: ApiMessage[];
  tools?: ToolDefinition[];
  maxTokens: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface AssistantTurn {
  content: ContentBlock[];
  stopReason: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export type ModelStreamEvent =
  | {
      type: 'text_delta';
      text: string;
    }
  | {
      type: 'tool_use_start';
      id: string;
      name: string;
    }
  | {
      type: 'turn_complete';
      turn: AssistantTurn;
    };

export interface AiClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  apiVersion?: string;
}

type GroqTool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

type GroqMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
};

export class AiClient {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private fetchImpl: typeof fetch;

  constructor(options: AiClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (
      options.baseUrl ??
      'https://api.groq.com/openai/v1'
    ).replace(/\/$/, '');

    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private normalizeTools(
    tools?: ToolDefinition[],
  ): GroqTool[] | undefined {
    if (!tools?.length) return undefined;

    return tools.map((raw) => {
      /*
       * Mathmind's ToolDefinition may use slightly different names
       * depending on which version of the project created it.
       *
       * We accept:
       *   parameters
       *   input_schema
       *   inputSchema
       */
      const tool = raw as ToolDefinition & {
        parameters?: unknown;
        input_schema?: unknown;
        inputSchema?: unknown;
        name: string;
        description?: string;
      };

      let parameters: Record<string, unknown> = {
        type: 'object',
        properties: {},
      };

      if (
        tool.parameters &&
        typeof tool.parameters === 'object'
      ) {
        parameters = tool.parameters as Record<string, unknown>;
      } else if (
        tool.input_schema &&
        typeof tool.input_schema === 'object'
      ) {
        parameters =
          tool.input_schema as Record<string, unknown>;
      } else if (
        tool.inputSchema &&
        typeof tool.inputSchema === 'object'
      ) {
        parameters =
          tool.inputSchema as Record<string, unknown>;
      }

      return {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description ?? '',
          parameters,
        },
      };
    });
  }

  private convertMessages(
    request: CompletionRequest,
  ): GroqMessage[] {
    const messages: GroqMessage[] = [];

    if (request.system?.trim()) {
      messages.push({
        role: 'system',
        content: request.system,
      });
    }

    for (const message of request.messages) {
      /*
       * User/assistant text messages
       */
      if (typeof message.content === 'string') {
        messages.push({
          role: message.role,
          content: message.content,
        });

        continue;
      }

      /*
       * Content blocks.
       */
      const textParts: string[] = [];
      const toolCalls: GroqMessage['tool_calls'] = [];

      for (const block of message.content) {
        if (block.type === 'text') {
          textParts.push(block.text);
        }

        if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(
                block.input ?? {},
              ),
            },
          });
        }

        /*
         * Tool results are sent as OpenAI/Groq tool messages.
         */
        if (block.type === 'tool_result') {
          messages.push({
            role: 'tool',
            tool_call_id: block.tool_use_id,
            content: block.content,
          });
        }
      }

      /*
       * If this is an assistant message containing tool calls,
       * send it as an assistant tool-call message.
       */
      if (message.role === 'assistant') {
        const assistantMessage: GroqMessage = {
          role: 'assistant',
          content:
            textParts.length > 0
              ? textParts.join('')
              : null,
        };

        if (toolCalls.length) {
          assistantMessage.tool_calls = toolCalls;
        }

        messages.push(assistantMessage);
      } else if (textParts.length) {
        messages.push({
          role: 'user',
          content: textParts.join(''),
        });
      }
    }

    return messages;
  }

  private async send(
    request: CompletionRequest,
    stream: boolean,
  ): Promise<Response> {
    if (!this.apiKey) {
      throw new AppError(
        'unauthorized',
        'GROQ_API_KEY is not configured.',
        { status: 500 },
      );
    }

    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    if (request.signal) {
      if (request.signal.aborted) {
        controller.abort();
      } else {
        request.signal.addEventListener(
          'abort',
          () => controller.abort(),
          { once: true },
        );
      }
    }

    const body: Record<string, unknown> = {
      model:
        request.model ||
        process.env.GROQ_MODEL ||
        'llama-3.3-70b-versatile',

      messages: this.convertMessages(request),

      max_tokens: request.maxTokens,

      stream,

      temperature:
        typeof request.temperature === 'number'
          ? request.temperature
          : 0.2,
    };

    const tools = this.normalizeTools(request.tools);

    if (tools?.length) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    let response: Response;

    try {
      response = await this.fetchImpl(
        `${this.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
    } catch (err) {
      clearTimeout(timer);

      if (request.signal?.aborted) {
        throw new AppError(
          'aborted',
          'Generation was stopped.',
          { status: 499 },
        );
      }

      if (
        (err as Error)?.name === 'AbortError'
      ) {
        throw new AppError(
          'timeout',
          'The AI service did not respond in time.',
        );
      }

      throw new AppError(
        'upstream_error',
        `Could not reach Groq: ${
          (err as Error)?.message ??
          'Unknown network error'
        }`,
      );
    }

    clearTimeout(timer);

    if (!response.ok) {
      const text = await response
        .text()
        .catch(() => '');

      throw mapGroqHttpError(
        response.status,
        text,
      );
    }

    return response;
  }

  async complete(
    request: CompletionRequest,
  ): Promise<AssistantTurn> {
    const response = await this.send(
      request,
      false,
    );

    const json = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            type: 'function';
            function: {
              name: string;
              arguments: string;
            };
          }>;
        };
        finish_reason?: string | null;
      }>;

      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
      };
    };

    const choice = json.choices?.[0];
    const message = choice?.message;

    const content: ContentBlock[] = [];

    if (message?.content) {
      content.push({
        type: 'text',
        text: message.content,
      });
    }

    for (const tool of message?.tool_calls ?? []) {
      let input: unknown = {};

      try {
        input = tool.function.arguments
          ? JSON.parse(tool.function.arguments)
          : {};
      } catch {
        input = {};
      }

      content.push({
        type: 'tool_use',
        id: tool.id,
        name: tool.function.name,
        input,
      });
    }

    const stopReason =
      message?.tool_calls?.length
        ? 'tool_use'
        : normalizeStopReason(
            choice?.finish_reason,
          );

    return {
      content,
      stopReason,
      usage: {
        inputTokens:
          json.usage?.prompt_tokens ?? 0,
        outputTokens:
          json.usage?.completion_tokens ?? 0,
      },
    };
  }

  async *stream(
    request: CompletionRequest,
  ): AsyncGenerator<ModelStreamEvent> {
    const response = await this.send(
      request,
      true,
    );

    if (!response.body) {
      throw new AppError(
        'upstream_error',
        'Groq returned an empty stream.',
      );
    }

    const reader =
      response.body.getReader();

    const decoder = new TextDecoder();

    let buffer = '';

    const blocks: ContentBlock[] = [];

    const toolState = new Map<
      number,
      {
        id: string;
        name: string;
        arguments: string;
        started: boolean;
      }
    >();

    let stopReason: string | null = null;
    let reasoningText = '';

    const usage = {
      inputTokens: 0,
      outputTokens: 0,
    };

    try {
      for (;;) {
        const { done, value } =
          await reader.read();

        if (done) break;

        buffer += decoder.decode(value, {
          stream: true,
        });

        /*
         * Groq uses SSE.
         *
         * Events are separated by a blank line.
         */
        let separator: number;

        while (
          (separator =
            buffer.indexOf('\n\n')) !== -1
        ) {
          const frame = buffer.slice(
            0,
            separator,
          );

          buffer = buffer.slice(
            separator + 2,
          );

          for (const line of frame.split('\n')) {
            const trimmed =
              line.trim();

            if (
              !trimmed.startsWith('data:')
            ) {
              continue;
            }

            const raw = trimmed
              .slice(5)
              .trim();

            if (
              !raw ||
              raw === '[DONE]'
            ) {
              continue;
            }

            let event: {
              choices?: Array<{
                delta?: {
                  content?: string | null;
                  /*
                   * Reasoning models (gpt-oss, qwen3, deepseek-r1) put their
                   * chain of thought here instead of in `content`. If a turn
                   * produces only reasoning, ignoring this field yields a
                   * completely empty answer.
                   */
                  reasoning?: string | null;
                  reasoning_content?: string | null;
                  tool_calls?: Array<{
                    index?: number;
                    id?: string;
                    type?: string;
                    function?: {
                      name?: string;
                      arguments?: string;
                    };
                  }>;
                };
                finish_reason?: string | null;
              }>;
              usage?: {
                prompt_tokens?: number;
                completion_tokens?: number;
              };
              error?: {
                message?: string;
                type?: string;
              };
            };

            try {
              event =
                JSON.parse(raw);
            } catch {
              continue;
            }

            if (event.error) {
              throw new AppError(
                'upstream_error',
                event.error.message ??
                  'Groq returned an error.',
              );
            }

            const choice =
              event.choices?.[0];

            if (!choice) {
              if (event.usage) {
                usage.inputTokens =
                  event.usage
                    .prompt_tokens ?? 0;

                usage.outputTokens =
                  event.usage
                    .completion_tokens ?? 0;
              }

              continue;
            }

            const delta =
              choice.delta;

            const reasoningDelta =
              delta?.reasoning ??
              delta?.reasoning_content;

            if (reasoningDelta) {
              reasoningText += reasoningDelta;
            }

            /*
             * Normal text streaming.
             */
            if (
              delta?.content
            ) {
              let textBlock =
                blocks.find(
                  (block) =>
                    block.type ===
                    'text',
                );

              if (
                !textBlock ||
                textBlock.type !==
                  'text'
              ) {
                textBlock = {
                  type: 'text',
                  text: '',
                };

                blocks.push(
                  textBlock,
                );
              }

              textBlock.text +=
                delta.content;

              yield {
                type: 'text_delta',
                text: delta.content,
              };
            }

            /*
             * Tool-call streaming.
             */
            for (
              const call of
                delta?.tool_calls ??
                []
            ) {
              const index =
                call.index ?? 0;

              let state =
                toolState.get(
                  index,
                );

              if (!state) {
                state = {
                  id:
                    call.id ??
                    `call_${index}`,
                  name:
                    call.function
                      ?.name ?? '',
                  arguments: '',
                  started: false,
                };

                toolState.set(
                  index,
                  state,
                );
              }

              if (call.id) {
                state.id =
                  call.id;
              }

              if (
                call.function?.name
              ) {
                state.name =
                  call.function.name;
              }

              if (
                call.function
                  ?.arguments
              ) {
                state.arguments +=
                  call.function.arguments;
              }

              if (
                !state.started &&
                state.name
              ) {
                state.started = true;

                yield {
                  type: 'tool_use_start',
                  id: state.id,
                  name: state.name,
                };
              }
            }

            if (
              choice.finish_reason
            ) {
              stopReason =
                choice.finish_reason;
            }

            if (event.usage) {
              usage.inputTokens =
                event.usage
                  .prompt_tokens ?? 0;

              usage.outputTokens =
                event.usage
                  .completion_tokens ?? 0;
            }
          }
        }
      }
    } finally {
      reader.releaseLock?.();
    }

    /*
     * Convert completed Groq tool calls
     * into the ContentBlock format expected
     * by runAgent().
     */
    for (
      const state of toolState.values()
    ) {
      let input: unknown = {};

      try {
        input = state.arguments.trim()
          ? JSON.parse(
              state.arguments,
            )
          : {};
      } catch {
        input = {};
      }

      blocks.push({
        type: 'tool_use',
        id: state.id,
        name: state.name,
        input,
      });
    }

    if (toolState.size > 0) {
      stopReason = 'tool_use';
    }

    yield {
      type: 'turn_complete',
      turn: {
        /*
         * If a reasoning model produced only chain-of-thought and never
         * emitted `content` or a tool call, surface the reasoning rather than
         * returning an empty turn, which the UI would render as a blank reply.
         */
        content:
          blocks.length === 0 && reasoningText.trim()
            ? [{ type: 'text', text: reasoningText }]
            : blocks,
        stopReason:
          normalizeStopReason(
            stopReason,
          ),
        usage,
      },
    };
  }
}

function normalizeStopReason(
  reason: string | null | undefined,
): string | null {
  if (!reason) return null;

  if (
    reason === 'tool_calls' ||
    reason === 'function_call'
  ) {
    return 'tool_use';
  }

  if (reason === 'stop') {
    return 'end_turn';
  }

  return reason;
}

function mapGroqHttpError(
  status: number,
  body: string,
): AppError {
  let message = body;

  try {
    const parsed = JSON.parse(body) as {
      error?: {
        message?: string;
        type?: string;
        code?: string;
      };
    };

    if (parsed.error?.message) {
      message =
        parsed.error.message;
    }
  } catch {
    // Keep original response text.
  }

  const short =
    message.slice(0, 500) ||
    `HTTP ${status}`;

  if (
    status === 401 ||
    status === 403
  ) {
    return new AppError(
      'unauthorized',
      `Groq API key was rejected: ${short}`,
      { status: 500 },
    );
  }

  if (status === 404) {
    return new AppError(
      'invalid_request',
      `Groq endpoint or model was not found. Check GROQ_MODEL. ${short}`,
      { status: 404 },
    );
  }

  if (status === 429) {
    return new AppError(
      'rate_limited',
      `Groq rate limit reached: ${short}`,
    );
  }

  if (
    status === 400 ||
    status === 422
  ) {
    return new AppError(
      'invalid_request',
      `Groq rejected the request: ${short}`,
    );
  }

  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return new AppError(
      'upstream_error',
      `Groq service error (${status}): ${short}`,
    );
  }

  return new AppError(
    'upstream_error',
    `Groq API error (${status}): ${short}`,
  );
}
