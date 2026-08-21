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

type OpenAITool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: unknown;
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
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AiClientOptions) {
    this.apiKey = options.apiKey;

    // IMPORTANT:
    // Groq's OpenAI-compatible endpoint.
    this.baseUrl = (
      options.baseUrl ?? 'https://api.groq.com/openai/v1'
    ).replace(/\/$/, '');

    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private convertTool(tool: ToolDefinition): OpenAITool {
    const t = tool as unknown as Record<string, unknown>;

    const name =
      typeof t.name === 'string'
        ? t.name
        : typeof t['function'] === 'object' &&
            t['function'] !== null &&
            typeof (t['function'] as Record<string, unknown>).name === 'string'
          ? ((t['function'] as Record<string, unknown>).name as string)
          : 'unknown_tool';

    const description =
      typeof t.description === 'string'
        ? t.description
        : typeof t['function'] === 'object' &&
            t['function'] !== null &&
            typeof (t['function'] as Record<string, unknown>).description ===
              'string'
          ? ((t['function'] as Record<string, unknown>).description as string)
          : undefined;

    // Your old code used `parameters`, but your ToolDefinition does not
    // expose that property. Some versions of the app use input_schema.
    const parameters =
      t.parameters &&
      typeof t.parameters === 'object' &&
      !Array.isArray(t.parameters)
        ? (t.parameters as Record<string, unknown>)
        : t.input_schema &&
            typeof t.input_schema === 'object' &&
            !Array.isArray(t.input_schema)
          ? (t.input_schema as Record<string, unknown>)
          : t['function'] &&
              typeof t['function'] === 'object' &&
              t['function'] !== null &&
              typeof (t['function'] as Record<string, unknown>).parameters ===
                'object'
            ? ((t['function'] as Record<string, unknown>)
                .parameters as Record<string, unknown>)
            : {
                type: 'object',
                properties: {},
                additionalProperties: false,
              };

    return {
      type: 'function',
      function: {
        name,
        ...(description ? { description } : {}),
        parameters,
      },
    };
  }

  private convertContentBlock(block: ContentBlock): unknown {
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

    if (block.type === 'tool_result') {
      return {
        type: 'tool_result',
        tool_use_id: block.tool_use_id,
        content: block.content,
      };
    }

    if (block.type === 'tool_use') {
      return {
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: block.input,
      };
    }

    return null;
  }

  private convertMessages(
    system: string,
    messages: ApiMessage[],
  ): OpenAIMessage[] {
    const result: OpenAIMessage[] = [];

    if (system.trim()) {
      result.push({
        role: 'system',
        content: system,
      });
    }

    for (const message of messages) {
      if (typeof message.content === 'string') {
        result.push({
          role: message.role,
          content: message.content,
        });

        continue;
      }

      const blocks = message.content;

      // Tool results must become OpenAI `tool` messages.
      const toolResults = blocks.filter(
        (block): block is Extract<ContentBlock, { type: 'tool_result' }> =>
          block.type === 'tool_result',
      );

      if (toolResults.length > 0) {
        for (const resultBlock of toolResults) {
          result.push({
            role: 'tool',
            tool_call_id: resultBlock.tool_use_id,
            content: resultBlock.content,
          });
        }

        // Include any normal text that was sent along with the results.
        const text = blocks
          .filter(
            (block): block is Extract<ContentBlock, { type: 'text' }> =>
              block.type === 'text',
          )
          .map((block) => block.text)
          .join('');

        if (text) {
          result.push({
            role: 'user',
            content: text,
          });
        }

        continue;
      }

      // Assistant tool calls.
      const toolUses = blocks.filter(
        (block): block is Extract<ContentBlock, { type: 'tool_use' }> =>
          block.type === 'tool_use',
      );

      const text = blocks
        .filter(
          (block): block is Extract<ContentBlock, { type: 'text' }> =>
            block.type === 'text',
        )
        .map((block) => block.text)
        .join('');

      if (message.role === 'assistant' && toolUses.length > 0) {
        result.push({
          role: 'assistant',
          content: text || null,
          tool_calls: toolUses.map((tool) => ({
            id: tool.id,
            type: 'function',
            function: {
              name: tool.name,
              arguments: JSON.stringify(tool.input ?? {}),
            },
          })),
        });

        continue;
      }

      result.push({
        role: message.role,
        content: blocks
          .map((block) => this.convertContentBlock(block))
          .filter(Boolean),
      });
    }

    return result;
  }

  private buildBody(
    request: CompletionRequest,
    stream: boolean,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: this.convertMessages(request.system, request.messages),
      max_tokens: request.maxTokens,
      stream,
    };

    if (request.tools?.length) {
      body.tools = request.tools.map((tool) => this.convertTool(tool));
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
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(
            this.buildBody(request, stream),
          ),
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
        `Could not reach the AI service: ${(err as Error)?.message ?? 'Unknown error'}`,
      );
    }

    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw mapHttpError(response.status, text);
    }

    return response;
  }

  async complete(
    request: CompletionRequest,
  ): Promise<AssistantTurn> {
    const response = await this.send(request, false);

    const json = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            type: string;
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

    for (const toolCall of message?.tool_calls ?? []) {
      let input: unknown = {};

      try {
        input = toolCall.function.arguments
          ? JSON.parse(toolCall.function.arguments)
          : {};
      } catch {
        input = {};
      }

      content.push({
        type: 'tool_use',
        id: toolCall.id,
        name: toolCall.function.name,
        input,
      });
    }

    let stopReason: string | null =
      choice?.finish_reason ?? null;

    if (stopReason === 'tool_calls') {
      stopReason = 'tool_use';
    }

    return {
      content,
      stopReason,
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

    let inputTokens = 0;
    let outputTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines = buffer.split('\n');

        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed.startsWith('data:')) {
            continue;
          }

          const raw = trimmed.slice(5).trim();

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
            event = JSON.parse(raw);
          } catch {
            continue;
          }

          if (event.error) {
            throw new AppError(
              'upstream_error',
              event.error.message ??
                'The AI service returned an error.',
            );
          }

          if (event.usage) {
            inputTokens =
              event.usage.prompt_tokens ?? inputTokens;

            outputTokens =
              event.usage.completion_tokens ?? outputTokens;
          }

          const choice = event.choices?.[0];

          if (!choice) {
            continue;
          }

          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
          }

          const delta = choice.delta;

          if (!delta) {
            continue;
          }

          if (delta.content) {
            textParts.push(delta.content);

            yield {
              type: 'text_delta',
              text: delta.content,
            };
          }

          for (const toolDelta of delta.tool_calls ?? []) {
            const index = toolDelta.index;

            let current = toolCalls.get(index);

            if (!current) {
              current = {
                id: toolDelta.id ?? `tool_${index}`,
                name: toolDelta.function?.name ?? '',
                arguments:
                  toolDelta.function?.arguments ?? '',
              };

              toolCalls.set(index, current);

              if (current.name) {
                yield {
                  type: 'tool_use_start',
                  id: current.id,
                  name: current.name,
                };
              }
            } else {
              if (toolDelta.id) {
                current.id = toolDelta.id;
              }

              if (toolDelta.function?.name) {
                current.name += toolDelta.function.name;
              }

              if (toolDelta.function?.arguments) {
                current.arguments +=
                  toolDelta.function.arguments;
              }
            }
          }
        }
      }

      // Process anything remaining in the buffer.
      const finalLine = buffer.trim();

      if (finalLine.startsWith('data:')) {
        const raw = finalLine.slice(5).trim();

        if (raw && raw !== '[DONE]') {
          try {
            const event = JSON.parse(raw) as {
              choices?: Array<{
                delta?: {
                  content?: string | null;
                };
                finish_reason?: string | null;
              }>;
              usage?: {
                prompt_tokens?: number;
                completion_tokens?: number;
              };
            };

            const choice = event.choices?.[0];

            if (event.usage) {
              inputTokens =
                event.usage.prompt_tokens ?? inputTokens;

              outputTokens =
                event.usage.completion_tokens ?? outputTokens;
            }

            if (choice?.finish_reason) {
              finishReason = choice.finish_reason;
            }
          } catch {
            // Ignore incomplete final frame.
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const content: ContentBlock[] = [];

    const fullText = textParts.join('');

    if (fullText) {
      content.push({
        type: 'text',
        text: fullText,
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
    }

    if (finishReason === 'tool_calls') {
      finishReason = 'tool_use';
    }

    yield {
      type: 'turn_complete',
      turn: {
        content,
        stopReason: finishReason,
        usage: {
          inputTokens,
          outputTokens,
        },
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
    message.slice(0, 500) ||
    `HTTP ${status}`;

  if (status === 401) {
    return new AppError(
      'unauthorized',
      `Groq API key is invalid or missing: ${short}`,
      { status: 401 },
    );
  }

  if (status === 403) {
    return new AppError(
      'unauthorized',
      `Groq rejected the request: ${short}`,
      { status: 403 },
    );
  }

  if (status === 404) {
    return new AppError(
      'upstream_error',
      `Groq API endpoint or model was not found: ${short}`,
      { status: 404 },
    );
  }

  if (status === 429) {
    return new AppError(
      'rate_limited',
      `Groq rate limit reached: ${short}`,
      { status: 429 },
    );
  }

  if (status === 400) {
    return new AppError(
      'invalid_request',
      `Groq rejected the request: ${short}`,
      { status: 400 },
    );
  }

  if (status === 413) {
    return new AppError(
      'invalid_request',
      `The request is too large for Groq: ${short}`,
      { status: 413 },
    );
  }

  if (status === 500 || status === 502 || status === 503) {
    return new AppError(
      'upstream_overloaded',
      `Groq is temporarily unavailable: ${short}`,
      { status },
    );
  }

  return new AppError(
    'upstream_error',
    `Groq API error (${status}): ${short}`,
    { status },
  );
}
