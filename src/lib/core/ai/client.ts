import { AppError } from '../errors';
import type { ToolDefinition } from '../types';

/**
 * Minimal streaming client for the Anthropic Messages API built on fetch.
 *
 * Deliberately dependency-free: the whole request/stream path is plain
 * TypeScript, so it can be unit tested with an injected fetch implementation.
 */

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

/** Events surfaced while a single model turn streams in. */
export type ModelStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use_start'; id: string; name: string }
  | { type: 'turn_complete'; turn: AssistantTurn };

export interface AiClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  apiVersion?: string;
}

export class AiClient {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private fetchImpl: typeof fetch;
  private apiVersion: string;

  constructor(options: AiClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.apiVersion = options.apiVersion ?? '2023-06-01';
  }

  private buildBody(request: CompletionRequest, stream: boolean) {
    const body: Record<string, unknown> = {
      model: request.model,
      max_tokens: request.maxTokens,
      system: request.system,
      messages: request.messages,
      stream,
    };
    if (request.tools?.length) body.tools = request.tools;
    if (typeof request.temperature === 'number') body.temperature = request.temperature;
    return body;
  }

  private async send(request: CompletionRequest, stream: boolean): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    if (request.signal) {
      if (request.signal.aborted) controller.abort();
      else request.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.apiVersion,
        },
        body: JSON.stringify(this.buildBody(request, stream)),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (request.signal?.aborted) throw new AppError('aborted', 'Generation was stopped.', { status: 499 });
      if ((err as Error)?.name === 'AbortError') {
        throw new AppError('timeout', 'The AI service did not respond in time.');
      }
      throw new AppError('upstream_error', `Could not reach the AI service: ${(err as Error).message}`);
    }
    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw mapHttpError(response.status, text);
    }
    return response;
  }

  /** Non-streaming call, used for titles and summaries. */
  async complete(request: CompletionRequest): Promise<AssistantTurn> {
    const response = await this.send(request, false);
    const json = (await response.json()) as {
      content: ContentBlock[];
      stop_reason: string | null;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    return {
      content: json.content ?? [],
      stopReason: json.stop_reason ?? null,
      usage: {
        inputTokens: json.usage?.input_tokens ?? 0,
        outputTokens: json.usage?.output_tokens ?? 0,
      },
    };
  }

  /** Streams one assistant turn, reassembling content blocks as it goes. */
  async *stream(request: CompletionRequest): AsyncGenerator<ModelStreamEvent> {
    const response = await this.send(request, true);
    if (!response.body) throw new AppError('upstream_error', 'The AI service returned an empty stream.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const blocks: ContentBlock[] = [];
    const partialJson: Record<number, string> = {};
    let stopReason: string | null = null;
    const usage = { inputTokens: 0, outputTokens: 0 };

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          for (const line of frame.split('\n')) {
            const trimmed = line.trimStart();
            if (!trimmed.startsWith('data:')) continue;
            const raw = trimmed.slice(5).trim();
            if (!raw || raw === '[DONE]') continue;
            let event: Record<string, unknown>;
            try {
              event = JSON.parse(raw);
            } catch {
              continue;
            }

            switch (event.type) {
              case 'message_start': {
                const message = event.message as { usage?: { input_tokens?: number } } | undefined;
                usage.inputTokens = message?.usage?.input_tokens ?? 0;
                break;
              }
              case 'content_block_start': {
                const index = event.index as number;
                const block = event.content_block as ContentBlock;
                if (block.type === 'text') {
                  blocks[index] = { type: 'text', text: block.text ?? '' };
                } else if (block.type === 'tool_use') {
                  blocks[index] = { type: 'tool_use', id: block.id, name: block.name, input: {} };
                  partialJson[index] = '';
                  yield { type: 'tool_use_start', id: block.id, name: block.name };
                }
                break;
              }
              case 'content_block_delta': {
                const index = event.index as number;
                const delta = event.delta as { type: string; text?: string; partial_json?: string };
                if (delta.type === 'text_delta' && delta.text) {
                  const existing = blocks[index];
                  if (existing && existing.type === 'text') existing.text += delta.text;
                  else blocks[index] = { type: 'text', text: delta.text };
                  yield { type: 'text_delta', text: delta.text };
                } else if (delta.type === 'input_json_delta') {
                  partialJson[index] = (partialJson[index] ?? '') + (delta.partial_json ?? '');
                }
                break;
              }
              case 'content_block_stop': {
                const index = event.index as number;
                const block = blocks[index];
                if (block && block.type === 'tool_use') {
                  const raw = partialJson[index] ?? '';
                  try {
                    block.input = raw.trim() ? JSON.parse(raw) : {};
                  } catch {
                    block.input = {};
                  }
                }
                break;
              }
              case 'message_delta': {
                const delta = event.delta as { stop_reason?: string | null } | undefined;
                const u = event.usage as { output_tokens?: number } | undefined;
                if (delta?.stop_reason !== undefined) stopReason = delta.stop_reason;
                if (u?.output_tokens) usage.outputTokens = u.output_tokens;
                break;
              }
              case 'error': {
                const e = event.error as { message?: string; type?: string } | undefined;
                throw new AppError(
                  e?.type === 'overloaded_error' ? 'upstream_overloaded' : 'upstream_error',
                  e?.message ?? 'The AI service reported an error.',
                );
              }
              default:
                break;
            }
          }
        }
      }
    } finally {
      reader.releaseLock?.();
    }

    yield {
      type: 'turn_complete',
      turn: { content: blocks.filter(Boolean), stopReason, usage },
    };
  }
}

function mapHttpError(status: number, body: string): AppError {
  let message = body;
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; type?: string } };
    if (parsed.error?.message) message = parsed.error.message;
  } catch {
    /* keep raw body */
  }
  const short = message.slice(0, 400) || `HTTP ${status}`;
  if (status === 401 || status === 403) {
    return new AppError('unauthorized', `The AI service rejected the API key: ${short}`, { status: 500 });
  }
  if (status === 429) return new AppError('rate_limited', `Rate limited by the AI service: ${short}`);
  if (status === 400) return new AppError('invalid_request', `The AI service rejected the request: ${short}`);
  if (status === 529 || status === 503) {
    return new AppError('upstream_overloaded', 'The AI service is temporarily overloaded.');
  }
  return new AppError('upstream_error', `AI service error (${status}): ${short}`);
}
