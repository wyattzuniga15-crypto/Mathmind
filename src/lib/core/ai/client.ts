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
}

interface GroqToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface GroqMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
}

interface GroqResponse {
  choices?: Array<{
    message?: GroqMessage;
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export class AiClient {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private fetchImpl: typeof fetch;

  constructor(options: AiClientOptions) {
    this.apiKey = options.apiKey;

    this.baseUrl = (
      options.baseUrl ?? 'https://api.groq.com/openai/v1'
    ).replace(/\/$/, '');

    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /**
   * ToolDefinition differs slightly between versions of this project.
   * Read the schema dynamically so TypeScript does not require a
   * specific property name.
   */
  private getToolSchema(tool: ToolDefinition): unknown {
    const value = tool as unknown as Record<string, unknown>;

    return (
      value.inputSchema ??
      value.input_schema ??
      value.parameters ??
      {
        type: 'object',
        properties: {},
      }
    );
  }

  private getToolName(tool: ToolDefinition): string {
    const value = tool as unknown as Record<string, unknown>;

    return String(value.name ?? '');
  }

  private getToolDescription(tool: ToolDefinition): string {
    const value = tool as unknown as Record<string, unknown>;

    return String(value.description ?? '');
  }

  private mapTools(tools?: ToolDefinition[]) {
    if (!tools?.length) {
      return undefined;
    }

    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: this.getToolName(tool),
        description: this.getToolDescription(tool),
        parameters: this.getToolSchema(tool),
      },
    }));
  }

  private mapMessages(
    request: CompletionRequest,
  ): GroqMessage[] {
    const result: GroqMessage[] = [];

    if (request.system) {
      result.push({
        role: 'system',
        content: request.system,
      });
    }

    for (const message of request.messages) {
      if (typeof message.content === 'string') {
        result.push({
          role: message.role,
          content: message.content,
        });

        continue;
      }

      if (message.role === 'assistant') {
        const text = message.content
          .filter(
            (
              block,
            ): block is Extract<
              ContentBlock,
              { type: 'text' }
            > => block.type === 'text',
          )
          .map((block) => block.text)
          .join('');

        const toolUses = message.content.filter(
          (
            block,
          ): block is Extract<
            ContentBlock,
            { type: 'tool_use' }
          > => block.type === 'tool_use',
        );

        result.push({
          role: 'assistant',
          content: text || null,
          ...(toolUses.length
            ? {
                tool_calls: toolUses.map((tool) => ({
                  id: tool.id,
                  type: 'function' as const,
                  function: {
                    name: tool.name,
                    arguments: JSON.stringify(
                      tool.input ?? {},
                    ),
                  },
                })),
              }
            : {}),
        });

        continue;
      }

      const toolResults = message.content.filter(
        (
          block,
        ): block is Extract<
          ContentBlock,
          { type: 'tool_result' }
        > => block.type === 'tool_result',
      );

      const text = message.content
        .filter(
          (
            block,
          ): block is Extract<
            ContentBlock,
            { type: 'text' }
          > => block.type === 'text',
        )
        .map((block) => block.text)
        .join('');

      for (const resultBlock of toolResults) {
        result.push({
          role: 'tool',
          tool_call_id: resultBlock.tool_use_id,
          content: resultBlock.content,
        });
      }

      if (text) {
        result.push({
          role: 'user',
          content: text,
        });
      }
    }

    return result;
  }

  private buildBody(
    request: CompletionRequest,
    stream: boolean,
  ) {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: this.mapMessages(request),
      max_tokens: request.maxTokens,
      stream,
    };

    const tools = this.mapTools(request.tools);

    if (tools?.length) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    if (typeof request.temperature === 'number') {
      body.temperature = request.temperature;
    }

    return body;
  }

  private async send(
    request: CompletionRequest,
    stream: boolean,
  ): Promise<Response> {
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
          body: JSON.stringify(
            this.buildBody(request, stream),
          ),
          signal: controller.signal,
        },
      );
    } catch (error) {
      clearTimeout(timer);

      if (request.signal?.aborted) {
        throw new AppError(
          'aborted',
          'Generation was stopped.',
          { status: 499 },
        );
      }

      if ((error as Error)?.name === 'AbortError') {
        throw new AppError(
          'timeout',
          'The AI service did not respond in time.',
        );
      }

      throw new AppError(
        'upstream_error',
        `Could not reach the AI service: ${
          (error as Error).message
        }`,
      );
    }

    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text().catch(() => '');

      throw mapHttpError(
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

    const json =
      (await response.json()) as GroqResponse;

    const choice = json.choices?.[0];

    if (!choice?.message) {
      throw new AppError(
        'upstream_error',
        'The AI service returned an empty response.',
      );
    }

    const message = choice.message;
    const content: ContentBlock[] = [];

    if (message.content) {
      content.push({
        type: 'text',
        text: message.content,
      });
    }

    for (const call of message.tool_calls ?? []) {
      let input: unknown = {};

      try {
        input = call.function.arguments
          ? JSON.parse(call.function.arguments)
          : {};
      } catch {
        input = {};
      }

      content.push({
        type: 'tool_use',
        id: call.id,
        name: call.function.name,
        input,
      });
    }

    return {
      content,
      stopReason:
        message.tool_calls?.length
          ? 'tool_use'
          : choice.finish_reason ?? null,
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
        'The AI service returned an empty stream.',
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';

    const textParts: string[] = [];

    const toolCalls = new Map<
      number,
      {
        id: string;
        name: string;
        arguments: string;
      }
    >();

    let stopReason: string | null = null;

    const usage = {
      inputTokens: 0,
      outputTokens: 0,
    };

    try {
      for (;;) {
        const { done, value } =
          await reader.read();

        if (done) break;

        buffer += decoder.decode(
          value,
          { stream: true },
        );

        let newline: number;

        while (
          (newline = buffer.indexOf('\n')) !== -1
        ) {
          const line = buffer.slice(
            0,
            newline,
          );

          buffer = buffer.slice(
            newline + 1,
          );

          const trimmed = line.trim();

          if (!trimmed.startsWith('data:')) {
            continue;
          }

          const raw = trimmed
            .slice(5)
            .trim();

          if (!raw || raw === '[DONE]') {
            continue;
          }

          let event: {
            choices?: Array<{
              delta?: {
                content?: string | null;
                tool_calls?: Array<{
                  index: number;
                  id?: string;
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
          };

          try {
            event = JSON.parse(raw);
          } catch {
            continue;
          }

          if (event.usage) {
            usage.inputTokens =
              event.usage.prompt_tokens ??
              usage.inputTokens;

            usage.outputTokens =
              event.usage.completion_tokens ??
              usage.outputTokens;
          }

          const choice =
            event.choices?.[0];

          if (!choice) continue;

          if (choice.finish_reason) {
            stopReason =
              choice.finish_reason;
          }

          const delta =
            choice.delta;

          if (!delta) continue;

          if (delta.content) {
            textParts.push(
              delta.content,
            );

            yield {
              type: 'text_delta',
              text: delta.content,
            };
          }

          for (
            const toolDelta of
              delta.tool_calls ?? []
          ) {
            const index =
              toolDelta.index;

            let call =
              toolCalls.get(index);

            if (!call) {
              call = {
                id:
                  toolDelta.id ??
                  `tool_${index}`,
                name:
                  toolDelta.function
                    ?.name ?? '',
                arguments: '',
              };

              toolCalls.set(
                index,
                call,
              );
            }

            if (toolDelta.id) {
              call.id =
                toolDelta.id;
            }

            if (
              toolDelta.function
                ?.name
            ) {
              call.name +=
                toolDelta.function.name;
            }

            if (
              toolDelta.function
                ?.arguments
            ) {
              call.arguments +=
                toolDelta.function
                  .arguments;
            }
          }
        }
      }
    } finally {
      reader.releaseLock?.();
    }

    const content: ContentBlock[] = [];

    const text =
      textParts.join('');

    if (text) {
      content.push({
        type: 'text',
        text,
      });
    }

    for (
      const call of toolCalls.values()
    ) {
      let input: unknown = {};

      try {
        input = call.arguments.trim()
          ? JSON.parse(
              call.arguments,
            )
          : {};
      } catch {
        input = {};
      }

      content.push({
        type: 'tool_use',
        id: call.id,
        name: call.name,
        input,
      });

      yield {
        type: 'tool_use_start',
        id: call.id,
        name: call.name,
      };
    }

    if (
      toolCalls.size > 0 ||
      stopReason === 'tool_calls'
    ) {
      stopReason = 'tool_use';
    }

    yield {
      type: 'turn_complete',
      turn: {
        content,
        stopReason,
        usage,
      },
    };
  }
}

function mapHttpError(
  status: number,
  body: string,
): AppError {
  let message = body;

  try {
    const parsed = JSON.parse(body) as {
      error?: {
        message?: string;
      };
    };

    if (parsed.error?.message) {
      message =
        parsed.error.message;
    }
  } catch {
    // Keep raw response.
  }

  const short =
    message.slice(0, 400) ||
    `HTTP ${status}`;

  if (
    status === 401 ||
    status === 403
  ) {
    return new AppError(
      'unauthorized',
      `The Groq API rejected the API key: ${short}`,
      { status: 500 },
    );
  }

  if (status === 429) {
    return new AppError(
      'rate_limited',
      `Groq rate limit reached: ${short}`,
    );
  }

  if (status === 400) {
    return new AppError(
      'invalid_request',
      `Groq rejected the request: ${short}`,
    );
  }

  if (
    status === 503 ||
    status === 529
  ) {
    return new AppError(
      'upstream_overloaded',
      'Groq is temporarily unavailable.',
    );
  }

  return new AppError(
    'upstream_error',
    `Groq API error (${status}): ${short}`,
  );
}
