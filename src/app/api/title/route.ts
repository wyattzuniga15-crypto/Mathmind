import '@/lib/subjects';
import { getServerConfig } from '@/lib/core/env';
import { toAppError, AppError } from '@/lib/core/errors';
import { parseTitleRequest } from '@/lib/core/validate';
import { resolveIdentity, clientKey } from '@/lib/core/auth';
import { rateLimiter, assertAllowed } from '@/lib/core/ratelimit';
import { AiClient } from '@/lib/core/ai/client';
import { TITLE_PROMPT } from '@/lib/subjects/math/prompt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Names a conversation from its first message, using the cheap fast model. */
export async function POST(request: Request) {
  try {
    const config = getServerConfig();
    const { identity } = await resolveIdentity(request, { required: config.authRequired });
    assertAllowed(
      await rateLimiter.check(clientKey(request, identity), [
        { name: 'title_minute', limit: 30, windowMs: 60_000 },
      ]),
    );

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError('invalid_request', 'Request body must be valid JSON.');
    }
    const { text } = parseTitleRequest(body);

    const client = new AiClient({
      apiKey: config.apiKey,
      baseUrl: config.apiBaseUrl,
      timeoutMs: 20_000,
    });

    const turn = await client.complete({
      model: config.fastModel,
      system: TITLE_PROMPT,
      messages: [{ role: 'user', content: text.slice(0, 1000) }],
      maxTokens: 32,
      temperature: 0,
    });

    const title = turn.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .replace(/^["'\s]+|["'.\s]+$/g, '')
      .slice(0, 60);

    return Response.json({ title: title || 'New conversation' });
  } catch (err) {
    const appError = toAppError(err);
    // A failed title is cosmetic; never surface it as a hard error.
    return Response.json({ title: null, error: appError.code }, { status: 200 });
  }
}
