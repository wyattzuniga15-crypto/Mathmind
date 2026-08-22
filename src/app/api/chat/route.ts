import '@/lib/subjects';
import { getSubject } from '@/lib/core/registry';
import { getServerConfig } from '@/lib/core/env';
import { AppError, toAppError } from '@/lib/core/errors';
import { parseChatRequest } from '@/lib/core/validate';
import { resolveIdentity, clientKey } from '@/lib/core/auth';
import { rateLimiter, rateLimitHeaders, assertAllowed } from '@/lib/core/ratelimit';
import { buildContext, summarizeDropped } from '@/lib/core/memory';
import { eventStreamResponse } from '@/lib/core/sse';
import { AiClient } from '@/lib/core/ai/client';
import { runAgent } from '@/lib/core/ai/agent';
import type { StreamEvent } from '@/lib/core/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Vercel's Hobby plan caps functions at 60s. Requesting more can fail the
// build, and any AI timeout longer than this limit gets the stream killed
// mid-response, which the browser sees as a blank reply.
export const maxDuration = 60;

/**
 * The only path from browser to model.
 *
 * The API key lives in process.env on the server and is never serialised into
 * any response. The browser talks to this route; this route talks to the model
 * provider.
 *
 * This route MUST return a Server-Sent Event stream: the client reads it with
 * an incremental SSE parser (src/hooks/useChat.ts). Returning plain JSON on the
 * success path produces a silent failure in the UI, because no events are ever
 * emitted and the reply renders blank.
 *
 * It must also pass the subject's tools to the agent loop. Those tools are the
 * deterministic math engine; without them every answer is unverified model
 * arithmetic, which is the one thing this project exists to prevent.
 */
export async function POST(request: Request) {
  let limitHeaders: Record<string, string> = {};
  try {
    const config = getServerConfig();

    const { identity, setCookie } = await resolveIdentity(request, {
      adapter: null, // swap in a real AuthAdapter here to require accounts
      required: config.authRequired,
    });

    const limit = await rateLimiter.check(clientKey(request, identity), [
      { name: 'chat_minute', limit: config.rateLimitPerMinute, windowMs: 60_000 },
      { name: 'chat_day', limit: config.rateLimitPerDay, windowMs: 86_400_000 },
    ]);
    // Carry the limit headers onto a 429 too, so clients can back off correctly.
    limitHeaders = rateLimitHeaders(limit);
    assertAllowed(limit);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError('invalid_request', 'Request body must be valid JSON.');
    }

    const parsed = parseChatRequest(body);
    const subject = getSubject(parsed.subjectId);
    if (subject.status !== 'available') {
      throw new AppError('unknown_subject', `The ${subject.name} module is not available yet.`);
    }
    const mode = subject.modes.find((m) => m.id === parsed.mode)?.id ?? subject.defaultMode;

    // Trims the transcript to a budget and extracts "what problem are we on".
    // Images are converted to content blocks here, so the model can read a
    // photographed problem.
    const context = buildContext(parsed.messages);
    const memorySummary =
      parsed.memorySummary ?? summarizeDropped(parsed.messages, context.droppedCount);

    const lastMessage = parsed.messages[parsed.messages.length - 1];
    const system = subject.buildSystemPrompt({
      mode,
      level: parsed.level,
      memorySummary,
      sessionNotes: [...context.sessionNotes, ...(parsed.sessionNotes ?? [])],
      hasImages: Boolean(lastMessage.images?.length),
    });

    const client = new AiClient({
      apiKey: config.apiKey,
      baseUrl: config.apiBaseUrl,
      timeoutMs: config.requestTimeoutMs,
    });

    const events = runAgent({
      client,
      subject,
      system,
      messages: context.messages,
      model: config.model,
      maxTokens: config.maxTokens,
      maxIterations: config.maxToolIterations,
      context: { subjectId: subject.id, mode, level: parsed.level },
      signal: request.signal,
    });

    const headers: Record<string, string> = { ...limitHeaders };
    if (setCookie) headers['Set-Cookie'] = setCookie;
    return eventStreamResponse(events, { headers });
  } catch (err) {
    const appError = toAppError(err);
    // Errors raised before the stream opens are returned as JSON with a real
    // status code, but the client also accepts an SSE error frame, so ship the
    // same event shape in the body either way.
    const event: StreamEvent = {
      type: 'error',
      message: appError.message,
      code: appError.code,
      retryable: appError.retryable,
    };
    return new Response(JSON.stringify({ ...appError.toJSON(), event }), {
      status: appError.status,
      headers: { 'Content-Type': 'application/json', ...limitHeaders },
    });
  }
}
