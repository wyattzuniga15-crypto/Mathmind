import { AppError } from '../errors';
import type { ToolDefinition } from '../types';

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

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
  usage: { inputTokens: number; outputTokens: number };
}

export type ModelStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use_start'; id: string; name: string }
  | { type: 'turn_complete'; turn: AssistantTurn };

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
  role: 'assistant' | 'user' | 'tool' | 'system';
  content?: string | null;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
  name?: string;
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

  private mapContent(content: string | ContentBlock[]): unknown {
    if (typeof content === 'string') return content;

    return content.map((block) => {
      if (block.type === 'text') {
        return {
          type: 'text',
          text: block.text,
        };
      }

      if (block.type === 'image') {
        return {
          type: 'image_url',
          image_url: {
            url: `data:${block.source.media_type};base64,${block.source.data}`,
          },
        };
      }

      if (block.type === 'tool_use') {
        return {
          type: 'text',
          text: '',
        };
      }

      if (block.type === 'tool_result') {
        return {
          type: 'text',
          text: block.content,
        };
      }

      return {
        type: 'text',
        text: '',
      };
    });
  }

  private mapMessages(request: CompletionRequest): GroqMessage[] {
    const messages: GroqMessage[] = [];

    if (request.system) {
      messages.push({
        role: 'system',
        content: request.system,
      });
    }

    for (const message of request.messages) {
      if (typeof message.content === 'string') {
        messages.push({
          role: message.role,
          content: message.content,
        });
        continue;
      }

      const toolUses = message.content.filter(
        (block): block is Extract<ContentBlock, { type: 'tool_use' }> =>
          block.type === 'tool_use',
      );

      const toolResults = message.content.filter(
        (block): block is Extract<ContentBlock, { type: 'tool_result' }> =>
          block.type === 'tool_result',
      );

      const textBlocks = message.content.filter(
        (block): block is Extract<ContentBlock, { type: 'text' }> =>
          block.type === 'text',
      );

      if (message.role === 'assistant' && toolUses.length > 0) {
        messages.push({
          role: 'assistant',
          content: textBlocks.map((b) => b.text).join('') || null,
          tool_calls: toolUses.map((tool) => ({
            id: tool.id,
            type: 'function',
            function: {
              name: tool.name,
              arguments: JSON.stringify(tool.input ?? {}),
            },
          })),
        });
      } else if (message.role === 'user' && toolResults.length > 0) {
        for (const result of toolResults) {
          messages.push({
            role: 'tool',
            tool_call_id: result.tool_use_id,
            content: result.content,
          });
        }

        const text = textBlocks.map((b) => b.text).join('');
        if (text) {
          messages.push({
            role: 'user',
            content: text,
          });
        }
      } else {
        messages.push({
          role: message.role,
          content: this.mapContent(message.content) as string,
        });
      }
    }

    return messages;
  }

  private mapTools(tools?: ToolDefinition[]) {
    if (!tools?.length) return undefined;

    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  private buildBody(request: CompletionRequest, stream: boolean) {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: this.mapMessages(request),
      max_tokens: request.maxTokens,
      stream,
    };

    if (request.tools?.length) {
      body.tools = this.mapTools(request.tools);
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
          body: JSON.stringify(this.buildBody(request, stream)),
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

      if ((err as Error)?.name === 'AbortError') {
        throw new AppError(
          'timeout',
          'The AI service did not respond in time.',
        );
      }

      throw new AppError(
        'upstream_error',
        `Could not reach the AI service: ${(err as Error).message}`,
      );
    }

    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw mapHttpError(response.status, text);
    }

    return response;
  }

  async complete(request: CompletionRequest): Promise<AssistantTurn> {
    const response = await this.send(request, false);

    const json = (await response.json()) as GroqResponse;
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

    for (const tool of message.tool_calls ?? []) {
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

    return {
      content,
      stopReason:
        message.tool_calls?.length
          ? 'tool_use'
          : choice.finish_reason ?? null,
      usage: {
        inputTokens: json.usage?.prompt_tokens ?? 0,
        outputTokens: json.usage?.completion_tokens ?? 0,
      },
    };
  }

  async *stream(
    request: CompletionRequest,
  ): AsyncGenerator<ModelStreamEvent> {
    const response = await this.send(request, true);

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

    let finishReason: string | null = null;

    const usage = {
      inputTokens: 0,
      outputTokens: 0,
    };

    try {
      for (;;) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;

        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          const trimmed = line.trim();

          if (!trimmed.startsWith('data:')) continue;

          const raw = trimmed.slice(5).trim();

          if (!raw || raw === '[DONE]') continue;

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

          const choice = event.choices?.[0];

          if (!choice) continue;

          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
          }

          const delta = choice.delta;

          if (!delta) continue;

          if (delta.content) {
            textParts.push(delta.content);

            yield {
              type: 'text_delta',
              text: delta.content,
            };
          }

          for (const toolDelta of delta.tool_calls ?? []) {
            const index = toolDelta.index;

            let existing = toolCalls.get(index);

            if (!existing) {
              existing = {
                id: toolDelta.id ?? `tool_${index}`,
                name: toolDelta.function?.name ?? '',
                arguments: '',
              };

              toolCalls.set(index, existing);
            }

            if (toolDelta.id) {
              existing.id = toolDelta.id;
            }

            if (toolDelta.function?.name) {
              existing.name += toolDelta.function.name;
            }

            if (toolDelta.function?.arguments) {
              existing.arguments += toolDelta.function.arguments;
            }
          }
        }
      }
    } finally {
      reader.releaseLock?.();
    }

    const content: ContentBlock[] = [];

    const text = textParts.join('');

    if (text) {
      content.push({
        type: 'text',
        text,
      });
    }

    for (const tool of toolCalls.values()) {
      let input: unknown = {};

      try {
        input = tool.arguments.trim()
          ? JSON.parse(tool.arguments)
          : {};
      } catch {
        input = {};
      }

      content.push({
        type: 'tool_use',
        id: tool.id,
        name: tool.name,
        input,
      });

      yield {
        type: 'tool_use_start',
        id: tool.id,
        name: tool.name,
      };
    }

    if (finishReason === 'tool_calls' || toolCalls.size > 0) {
      finishReason = 'tool_use';
    }

    yield {
      type: 'turn_complete',
      turn: {
        content,
        stopReason: finishReason,
        usage,
      },
    };
  }
}

function mapHttpError(status: number, body: string): AppError {
  let message = body;

  try {
    const parsed = JSON.parse(body) as {
      error?: {
        message?: string;
        type?: string;
      };
    };

    if (parsed.error?.message) {
      message = parsed.error.message;
    }
  } catch {
    // Keep raw response.
  }

  const short =
    message.slice(0, 400) ||
    `HTTP ${status}`;

  if (status === 401 || status === 403) {
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

  if (status === 408 || status === 504) {
    return new AppError(
      'timeout',
      'The Groq AI service timed out.',
    );
  }

  if (status === 503) {
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
