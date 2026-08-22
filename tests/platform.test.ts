import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseChatRequest, base64Bytes } from '../src/lib/core/validate';
import { AppError } from '../src/lib/core/errors';
import { createRateLimiter, MemoryRateLimitStore, rateLimitHeaders } from '../src/lib/core/ratelimit';
import { buildContext, findActiveProblem, isFollowUp, summarizeDropped } from '../src/lib/core/memory';
import { createSseParser, encodeEvent } from '../src/lib/core/sse';
import { fingerprint, resolveIdentity, clientKey } from '../src/lib/core/auth';
import { AiClient } from '../src/lib/core/ai/client';
import { runAgent } from '../src/lib/core/ai/agent';
import { registerSubject, getSubject, listSubjects, __resetRegistry } from '../src/lib/core/registry';
import { mathSubject } from '../src/lib/subjects/math';
import type { StreamEvent } from '../src/lib/core/types';

const baseRequest = {
  subjectId: 'math',
  mode: 'solve',
  level: 'auto',
  messages: [{ role: 'user', content: '2x + 5 = 15' }],
};

/* ------------------------------ validation ------------------------------ */

test('accepts a well-formed chat request', () => {
  const parsed = parseChatRequest(baseRequest);
  assert.equal(parsed.subjectId, 'math');
  assert.equal(parsed.messages.length, 1);
  assert.equal(parsed.level, 'auto');
});

test('rejects malformed chat requests', () => {
  const bad: [unknown, RegExp][] = [
    [null, /must be an object/],
    [{ ...baseRequest, subjectId: 'Math!' }, /lowercase/],
    [{ ...baseRequest, messages: [] }, /cannot be empty/],
    [{ ...baseRequest, level: 'genius' }, /level must be one of/],
    [{ ...baseRequest, messages: [{ role: 'wizard', content: 'hi' }] }, /must be "user" or "assistant"/],
    [{ ...baseRequest, messages: [{ role: 'user', content: '' }] }, /text or at least one image/],
    [
      { ...baseRequest, messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'yo' }] },
      /last message must come from the user/,
    ],
  ];
  for (const [input, pattern] of bad) {
    assert.throws(() => parseChatRequest(input), pattern, `expected rejection for ${JSON.stringify(input)}`);
  }
});

test('validates image attachments', () => {
  const withImage = {
    ...baseRequest,
    messages: [
      { role: 'user', content: 'solve this', images: [{ data: 'aGVsbG8=', mediaType: 'image/png' }] },
    ],
  };
  assert.equal(parseChatRequest(withImage).messages[0].images!.length, 1);

  // data URLs are tolerated and stripped
  const dataUrl = {
    ...baseRequest,
    messages: [
      {
        role: 'user',
        content: 'x',
        images: [{ data: 'data:image/png;base64,aGVsbG8=', mediaType: 'image/png' }],
      },
    ],
  };
  assert.equal(parseChatRequest(dataUrl).messages[0].images![0].data, 'aGVsbG8=');

  assert.throws(
    () =>
      parseChatRequest({
        ...baseRequest,
        messages: [{ role: 'user', content: 'x', images: [{ data: 'aa', mediaType: 'image/tiff' }] }],
      }),
    /Unsupported image type/,
  );

  const huge = 'A'.repeat(8 * 1024 * 1024);
  assert.throws(
    () =>
      parseChatRequest({
        ...baseRequest,
        messages: [{ role: 'user', content: 'x', images: [{ data: huge, mediaType: 'image/png' }] }],
      }),
    /larger than/,
  );
  assert.ok(base64Bytes('aGVsbG8=') === 5);
});

/* ----------------------------- rate limiting ---------------------------- */

test('rate limiter blocks past the limit and reports headers', async () => {
  const limiter = createRateLimiter(new MemoryRateLimitStore());
  const rules = [{ name: 'test', limit: 3, windowMs: 60_000 }];
  const results = [];
  for (let i = 0; i < 4; i++) results.push(await limiter.check('user-a', rules));
  assert.deepEqual(results.map((r) => r.allowed), [true, true, true, false]);
  assert.equal(results[3].retryAfterSeconds > 0, true);

  // separate identities have separate buckets
  assert.equal((await limiter.check('user-b', rules)).allowed, true);

  const headers = rateLimitHeaders(results[3]);
  assert.equal(headers['X-RateLimit-Limit'], '3');
  assert.ok(headers['Retry-After']);
});

/* --------------------------------- auth --------------------------------- */

test('anonymous identity is stable via cookie', async () => {
  const withCookie = new Request('https://x.test', { headers: { cookie: 'tutor_anon_id=abc123def456' } });
  const a = await resolveIdentity(withCookie);
  assert.equal(a.identity.id, 'abc123def456');
  assert.equal(a.setCookie, undefined);

  const fresh = await resolveIdentity(new Request('https://x.test'));
  assert.equal(fresh.identity.kind, 'anonymous');
  assert.ok(fresh.setCookie?.includes('HttpOnly'));
  assert.ok(clientKey(withCookie, a.identity).startsWith('anon:'));

  // Anonymous rate-limit buckets must be stable even when the cookie changes,
  // otherwise dropping the cookie would defeat rate limiting entirely.
  const headers = { 'x-forwarded-for': '203.0.113.7', 'user-agent': 'Mozilla/5.0' };
  const r1 = new Request('https://x.test', { headers: { ...headers, cookie: 'tutor_anon_id=aaaaaaaaaaaa' } });
  const r2 = new Request('https://x.test', { headers });
  const i1 = (await resolveIdentity(r1)).identity;
  const i2 = (await resolveIdentity(r2)).identity;
  assert.notEqual(i1.id, i2.id);
  assert.equal(clientKey(r1, i1), clientKey(r2, i2));
  assert.equal(fingerprint('abc'), fingerprint('abc'));
  assert.notEqual(fingerprint('abc'), fingerprint('abd'));
});

test('auth can be required', async () => {
  await assert.rejects(
    () => resolveIdentity(new Request('https://x.test'), { required: true }),
    (e: AppError) => e.code === 'unauthorized',
  );
});

/* -------------------------------- memory -------------------------------- */

test('memory finds the active problem and detects follow-ups', () => {
  const messages = [
    { role: 'user' as const, content: '2x + 5 = 15' },
    { role: 'assistant' as const, content: 'x = 5' },
    { role: 'user' as const, content: 'why did you subtract 5?' },
  ];
  assert.equal(findActiveProblem(messages), '2x + 5 = 15');
  assert.ok(isFollowUp('why did you subtract 5?'));
  assert.ok(isFollowUp('what about step 3?'));
  assert.ok(isFollowUp("I don't understand"));
  assert.ok(!isFollowUp('Integrate x^2 from 0 to 3 and explain the fundamental theorem in detail please'));

  const ctx = buildContext(messages);
  assert.equal(ctx.messages.length, 3);
  assert.ok(ctx.sessionNotes.some((n) => n.includes('2x + 5 = 15')));
  assert.ok(ctx.sessionNotes.some((n) => n.includes('follow-up')));
});

test('memory trims long conversations but keeps recent turns', () => {
  const messages = Array.from({ length: 60 }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `message ${i} ${'x'.repeat(2000)}`,
  }));
  const ctx = buildContext(messages, { charBudget: 20_000, keepRecent: 6 });
  assert.ok(ctx.droppedCount > 0);
  assert.ok(ctx.messages.length >= 6);
  assert.equal(ctx.messages[0].role, 'user');
  assert.ok(summarizeDropped(messages, ctx.droppedCount)!.includes('no longer shown in full'));
});

test('memory converts images into API content blocks', () => {
  const ctx = buildContext([
    { role: 'user', content: '', images: [{ data: 'abc', mediaType: 'image/png' }] },
  ]);
  const content = ctx.messages[0].content;
  assert.ok(Array.isArray(content));
  assert.equal((content as { type: string }[])[0].type, 'image');
  assert.equal((content as { type: string }[])[1].type, 'text');
});

/* ---------------------------------- sse --------------------------------- */

test('sse round-trips events, including split chunks', () => {
  const received: StreamEvent[] = [];
  const parser = createSseParser((e) => received.push(e));
  const frame = encodeEvent({ type: 'text', delta: 'hello' }) + encodeEvent({ type: 'text', delta: ' world' });
  parser.push(frame.slice(0, 12));
  parser.push(frame.slice(12));
  assert.deepEqual(received, [
    { type: 'text', delta: 'hello' },
    { type: 'text', delta: ' world' },
  ]);
});

test('sse parser survives malformed frames', () => {
  const received: StreamEvent[] = [];
  const parser = createSseParser((e) => received.push(e));
  parser.push('data: {not json}\n\n');
  parser.push(encodeEvent({ type: 'text', delta: 'ok' }));
  assert.equal(received.length, 1);
});

/* ------------------------------- registry ------------------------------- */

test('registry exposes subjects and rejects duplicates', () => {
  __resetRegistry();
  registerSubject(mathSubject);
  assert.equal(getSubject('math').id, 'math');
  assert.equal(listSubjects().length, 1);
  assert.throws(() => registerSubject(mathSubject), /already registered/);
  assert.throws(() => getSubject('science'), (e: AppError) => e.code === 'unknown_subject');
});

/* -------------------------- ai client + agent --------------------------- */

/** Builds a fake SSE HTTP response mimicking the Groq/OpenAI streaming format. */
function mockStreamResponse(events: Record<string, unknown>[]): Response {
  const body = `${events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')}data: [DONE]\n\n`;
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function textTurn(text: string, finishReason = 'stop') {
  return [
    { choices: [{ delta: { content: text }, finish_reason: null }] },
    {
      choices: [{ delta: {}, finish_reason: finishReason }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    },
  ];
}

function toolTurn(name: string, input: Record<string, unknown>) {
  return [
    {
      choices: [
        {
          delta: {
            tool_calls: [
              { index: 0, id: 'call_1', type: 'function', function: { name, arguments: '' } },
            ],
          },
          finish_reason: null,
        },
      ],
    },
    {
      choices: [
        {
          delta: {
            tool_calls: [{ index: 0, function: { arguments: JSON.stringify(input) } }],
          },
          finish_reason: null,
        },
      ],
    },
    {
      choices: [{ delta: {}, finish_reason: 'tool_calls' }],
      usage: { prompt_tokens: 10, completion_tokens: 8 },
    },
  ];
}

async function collect(subject = mathSubject, responses: Response[] = []) {
  let call = 0;
  const client = new AiClient({
    apiKey: 'test-key',
    fetchImpl: (async () => responses[Math.min(call++, responses.length - 1)]) as unknown as typeof fetch,
  });
  const events: StreamEvent[] = [];
  for await (const e of runAgent({
    client,
    subject,
    system: 'test',
    messages: [{ role: 'user', content: '2x + 5 = 15' }],
    model: 'test-model',
    maxTokens: 100,
    maxIterations: 4,
    context: { subjectId: 'math', mode: 'solve', level: 'auto' },
  })) {
    events.push(e);
  }
  return events;
}

test('agent streams plain text turns', async () => {
  const events = await collect(mathSubject, [mockStreamResponse(textTurn('Hello student'))]);
  assert.equal(events[0].type, 'start');
  assert.equal(events.filter((e) => e.type === 'text').map((e) => (e as { delta: string }).delta).join(''), 'Hello student');
  const done = events.find((e) => e.type === 'done');
  assert.ok(done);
});

test('agent executes real tools and feeds results back', async () => {
  const events = await collect(mathSubject, [
    mockStreamResponse(toolTurn('solve_equation', { equation: '2x + 5 = 15' })),
    mockStreamResponse(textTurn('The answer is x = 5.')),
  ]);

  const call = events.find((e) => e.type === 'tool_call') as Extract<StreamEvent, { type: 'tool_call' }>;
  assert.equal(call.name, 'solve_equation');

  const result = events.find((e) => e.type === 'tool_result') as Extract<StreamEvent, { type: 'tool_result' }>;
  assert.equal(result.result.ok, true);
  // The tool genuinely solved it — this is the real engine, not a stub.
  const data = result.result.data as { solutions: { text: string }[] };
  assert.equal(data.solutions[0].text, '5');

  const done = events.find((e) => e.type === 'done') as Extract<StreamEvent, { type: 'done' }>;
  assert.equal(done.toolCalls.length, 1);
});

test('agent reports a failing tool without crashing the turn', async () => {
  const events = await collect(mathSubject, [
    mockStreamResponse(toolTurn('solve_equation', { equation: 'this is not math ((' })),
    mockStreamResponse(textTurn('I could not parse that.')),
  ]);
  const result = events.find((e) => e.type === 'tool_result') as Extract<StreamEvent, { type: 'tool_result' }>;
  assert.equal(result.result.ok, false);
  assert.ok(result.result.error);
  assert.ok(events.some((e) => e.type === 'done'));
});

test('agent surfaces upstream errors as error events', async () => {
  const client = new AiClient({
    apiKey: 'k',
    fetchImpl: (async () =>
      new Response(JSON.stringify({ error: { message: 'overloaded', type: 'server_error' } }), {
        status: 503,
      })) as unknown as typeof fetch,
  });
  const events: StreamEvent[] = [];
  for await (const e of runAgent({
    client,
    subject: mathSubject,
    system: 's',
    messages: [{ role: 'user', content: 'hi' }],
    model: 'm',
    maxTokens: 10,
    maxIterations: 2,
    context: { subjectId: 'math', mode: 'solve', level: 'auto' },
  })) {
    events.push(e);
  }
  const error = events.find((e) => e.type === 'error') as Extract<StreamEvent, { type: 'error' }>;
  // A 5xx from the provider must surface as a retryable upstream failure so the
  // UI offers "Try again" rather than looking like a client mistake.
  assert.ok(
    ['upstream_error', 'upstream_overloaded'].includes(error.code),
    `unexpected code ${error.code}`,
  );
  assert.equal(error.retryable, true);
});

test('client sends uploaded images to the model as image parts', async () => {
  // A photographed problem is the entire question for many students. If the
  // image never reaches the wire, the model answers a blank prompt.
  let sent: { messages: { role: string; content: unknown }[] } | null = null;
  const client = new AiClient({
    apiKey: 'test-key',
    fetchImpl: (async (_url: string, init: { body: string }) => {
      sent = JSON.parse(init.body) as typeof sent;
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch,
  });

  await client.complete({
    model: 'm',
    system: 's',
    maxTokens: 16,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAB' } },
          { type: 'text', text: 'Solve the problem in this photo.' },
        ],
      },
    ],
  });

  const userMessage = sent!.messages.find((m) => m.role === 'user');
  assert.ok(Array.isArray(userMessage!.content), 'image messages must use content parts');
  const parts = userMessage!.content as { type: string; text?: string; image_url?: { url: string } }[];
  assert.ok(parts.some((p) => p.type === 'text' && p.text === 'Solve the problem in this photo.'));
  const image = parts.find((p) => p.type === 'image_url');
  assert.ok(image, 'the image must survive the conversion to the provider format');
  assert.equal(image!.image_url!.url, 'data:image/png;base64,AAAB');
});

test('a retired model ID reports the models the key can actually use', async () => {
  // Groq retires model IDs on a schedule. A bare "model not found" leaves the
  // operator guessing, so the error has to name the working alternatives.
  const client = new AiClient({
    apiKey: 'test-key',
    fetchImpl: (async (url: string) => {
      if (url.endsWith('/models')) {
        return new Response(
          JSON.stringify({ data: [{ id: 'openai/gpt-oss-120b' }, { id: 'openai/gpt-oss-20b' }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          error: { message: 'The model `llama-3.1-8b-instant` does not exist or you do not have access to it.' },
        }),
        { status: 404 },
      );
    }) as unknown as typeof fetch,
  });

  await assert.rejects(
    () => client.complete({ model: 'llama-3.1-8b-instant', system: 's', messages: [], maxTokens: 5 }),
    (e: AppError) => {
      assert.equal(e.code, 'invalid_request');
      assert.match(e.message, /llama-3\.1-8b-instant/);
      assert.match(e.message, /openai\/gpt-oss-120b/);
      return true;
    },
  );
});

test('a model listing failure still produces an actionable 404', async () => {
  const client = new AiClient({
    apiKey: 'test-key',
    fetchImpl: (async (url: string) => {
      if (url.endsWith('/models')) throw new Error('network down');
      return new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: 404 });
    }) as unknown as typeof fetch,
  });

  await assert.rejects(
    () => client.complete({ model: 'gone', system: 's', messages: [], maxTokens: 5 }),
    (e: AppError) => e.code === 'invalid_request' && /console\.groq\.com/.test(e.message),
  );
});

test('client maps auth failures to a clear error', async () => {
  const client = new AiClient({
    apiKey: 'bad',
    fetchImpl: (async () =>
      new Response(JSON.stringify({ error: { message: 'Invalid API Key' } }), { status: 401 })) as unknown as typeof fetch,
  });
  await assert.rejects(
    () => client.complete({ model: 'm', system: 's', messages: [], maxTokens: 5 }),
    (e: AppError) => e.code === 'unauthorized',
  );
});

test('every math tool has a valid schema and executes', async () => {
  for (const tool of mathSubject.tools) {
    assert.match(tool.definition.name, /^[a-z_]+$/);
    assert.ok(tool.definition.description.length > 40, `${tool.definition.name} needs a real description`);
    assert.equal(tool.definition.input_schema.type, 'object');
    for (const key of tool.definition.input_schema.required ?? []) {
      assert.ok(
        key in tool.definition.input_schema.properties,
        `${tool.definition.name} requires "${key}" but does not declare it`,
      );
    }
    // Missing required input must fail gracefully, never throw.
    const result = await tool.execute({}, { subjectId: 'math', mode: 'solve', level: 'auto' });
    assert.equal(typeof result.ok, 'boolean');
  }
});
