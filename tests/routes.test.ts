import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Route handlers are plain Web-standard functions (Request in, Response out),
 * so they can be exercised directly without booting Next.js.
 */

const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://app.test/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

/** Rate limits bucket by client origin, so each test gets its own IP. */
const fromIp = (ip: string, body: unknown = validBody) =>
  json(body, { 'x-forwarded-for': ip, 'user-agent': `test-${ip}` });

async function loadChatRoute() {
  return (await import('../src/app/api/chat/route')) as {
    POST: (request: Request) => Promise<Response>;
  };
}

const validBody = {
  subjectId: 'math',
  mode: 'solve',
  level: 'auto',
  messages: [{ role: 'user', content: '2x + 5 = 15' }],
};

test('health route reports configuration state', async () => {
  const { GET } = (await import('../src/app/api/health/route')) as {
    GET: () => Promise<Response>;
  };
  const res = await GET();
  const body = (await res.json()) as { configured: boolean; message: string; subjects: unknown[] };
  assert.equal(typeof body.configured, 'boolean');
  assert.ok(body.message.length > 0);
  assert.ok(Array.isArray(body.subjects));
});

test('subjects route describes the platform for the UI', async () => {
  const { GET } = (await import('../src/app/api/subjects/route')) as {
    GET: () => Promise<Response>;
  };
  const body = (await (await GET()).json()) as {
    subjects: { id: string; modes: unknown[]; tools: unknown[]; suggestions: unknown[] }[];
  };
  const math = body.subjects.find((s) => s.id === 'math');
  assert.ok(math, 'math subject must be registered');
  assert.equal(math!.modes.length, 6);
  assert.ok(math!.tools.length >= 10);
  assert.ok(math!.suggestions.length > 0);
  // The payload must not carry anything server-only.
  assert.ok(!JSON.stringify(body).includes('sk-ant'));
  assert.ok(!JSON.stringify(body).includes('buildSystemPrompt'));
});

test('chat route rejects invalid JSON with a structured error', async () => {
  process.env.GROQ_API_KEY = 'gsk-test-not-real';
  const { POST } = await loadChatRoute();
  const res = await POST(
    new Request('https://app.test/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json at all',
    }),
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: { code: string; message: string } };
  assert.equal(body.error.code, 'invalid_request');
});

test('chat route validates the body before calling the model', async () => {
  process.env.GROQ_API_KEY = 'gsk-test-not-real';
  const { POST } = await loadChatRoute();

  const badSubject = await POST(json({ ...validBody, subjectId: 'astrology' }));
  assert.equal(badSubject.status, 404);
  assert.equal(((await badSubject.json()) as { error: { code: string } }).error.code, 'unknown_subject');

  const badLevel = await POST(json({ ...validBody, level: 'wizard' }));
  assert.equal(badLevel.status, 400);

  const empty = await POST(json({ ...validBody, messages: [] }));
  assert.equal(empty.status, 400);
});

test('chat route reports a missing API key clearly instead of failing obscurely', async () => {
  const saved = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    const { POST } = await loadChatRoute();
    const res = await POST(json(validBody));
    assert.equal(res.status, 500);
    const body = (await res.json()) as { error: { code: string; message: string } };
    assert.equal(body.error.code, 'missing_api_key');
    assert.match(body.error.message, /GROQ_API_KEY/);
  } finally {
    if (saved) process.env.GROQ_API_KEY = saved;
  }
});

test('chat route switches to the vision model when a message carries an image', async () => {
  process.env.GROQ_API_KEY = 'gsk-test-not-real';
  const { POST } = await loadChatRoute();

  const originalFetch = globalThis.fetch;
  const seenModels: string[] = [];
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { model?: string };
    if (body.model) seenModels.push(body.model);
    // A short-lived stub, not a full SSE server: the route only needs a
    // well-formed streaming response to read past the fetch call.
    return new Response('data: [DONE]\n\n', {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  }) as typeof fetch;

  try {
    const withImage = await POST(
      fromIp('198.51.100.9', {
        ...validBody,
        messages: [
          {
            role: 'user',
            content: 'What is the answer here?',
            images: [{ data: 'aGVsbG8=', mediaType: 'image/png' }],
          },
        ],
      }),
    );
    // Drain the stream so the fetch call inside runAgent actually happens.
    await withImage.text();

    const withoutImage = await POST(fromIp('198.51.100.10'));
    await withoutImage.text();
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(seenModels.length, 2);
  assert.notEqual(seenModels[0], seenModels[1], 'an image must route to a different model than plain text');
  assert.match(seenModels[0], /vision|scout|maverick|llama-4/i);
});

test('chat route sets an anonymous identity cookie and rate limit headers', async () => {
  process.env.GROQ_API_KEY = 'gsk-test-not-real';
  process.env.RATE_LIMIT_PER_MINUTE = '2';
  const { POST } = await loadChatRoute();

  // Requests fail at the upstream call (no network in tests), but the headers
  // and limiting happen before that and are what we assert here.
  const first = await POST(fromIp('198.51.100.5'));
  assert.equal(first.headers.get('X-RateLimit-Limit'), '2');
  assert.equal(first.headers.get('X-RateLimit-Remaining'), '1');
  assert.ok(first.headers.get('Set-Cookie')?.includes('HttpOnly'));

  await POST(fromIp('198.51.100.5'));
  const third = await POST(fromIp('198.51.100.5'));
  assert.equal(third.status, 429);
  const body = (await third.json()) as { error: { code: string; retryable: boolean } };
  assert.equal(body.error.code, 'rate_limited');
  assert.equal(body.error.retryable, true);
  assert.ok(third.headers.get('Retry-After'));

  delete process.env.RATE_LIMIT_PER_MINUTE;
});
