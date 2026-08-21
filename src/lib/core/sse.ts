import type { StreamEvent } from './types';

export function createId(prefix = 'id'): string {
  const rand =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

/** Encodes one application event as an SSE frame. */
export function encodeEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Incremental SSE parser for the browser side of the stream. */
export function createSseParser(onEvent: (event: StreamEvent) => void) {
  let buffer = '';
  return {
    push(chunk: string) {
      buffer += chunk;
      let index: number;
      while ((index = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        for (const line of frame.split('\n')) {
          const trimmed = line.trimStart();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            onEvent(JSON.parse(payload) as StreamEvent);
          } catch {
            /* ignore malformed frames rather than killing the stream */
          }
        }
      }
    },
    flush() {
      if (buffer.trim()) {
        this.push('\n\n');
      }
      buffer = '';
    },
  };
}

/** Wraps an async generator of events into a streaming HTTP Response body. */
export function eventStreamResponse(
  events: AsyncGenerator<StreamEvent>,
  init: { headers?: Record<string, string> } = {},
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of events) {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Stream failed';
        controller.enqueue(
          encoder.encode(
            encodeEvent({ type: 'error', message, code: 'internal_error', retryable: true }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...init.headers,
    },
  });
}
