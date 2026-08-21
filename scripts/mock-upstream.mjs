#!/usr/bin/env node
/**
 * Offline stand-in for the Anthropic Messages API.
 *
 * SCOPE: this replaces ONLY the language model, and only when no API key is
 * available. It speaks the real SSE wire format, so the application's client,
 * agent loop, tool dispatch, streaming, and UI all run their production code
 * paths against it.
 *
 * It deliberately does NOT invent math. It asks for a real tool call, then
 * builds its reply out of the values the real math engine returned in the
 * tool_result. That is what makes the end-to-end test meaningful: every number
 * rendered in the browser came from the engine, not from this file.
 *
 * Never used by the Next.js application. Point ANTHROPIC_BASE_URL at it.
 */
import { createServer } from 'node:http';

const enc = (obj) => `event: ${obj.type}\ndata: ${JSON.stringify(obj)}\n\n`;

/** Chooses a tool the way a tutor model would, from the student's text. */
function planToolCall(text, toolNames) {
  const t = text.toLowerCase();
  const has = (n) => toolNames.includes(n);

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const equationLines = lines.filter((l) => /=/.test(l) && /[a-z]/i.test(l));
  if (has('check_work') && (t.includes('did i') || t.includes('check my work') || equationLines.length >= 3)) {
    return { name: 'check_work', input: { lines: equationLines, originalProblem: equationLines[0] } };
  }
  if (has('differentiate') && (t.includes('derivative') || t.includes('differentiate'))) {
    const expr = /of\s+(.+?)(\?|$)/i.exec(text)?.[1]?.trim() ?? 'x^2';
    return { name: 'differentiate', input: { expression: expr } };
  }
  if (has('integrate') && t.includes('integral')) {
    return { name: 'integrate', input: { expression: 'x^2', from: '0', to: '3' } };
  }
  if (has('solve_system') && lines.filter((l) => /=/.test(l)).length >= 2 && t.includes('system')) {
    return { name: 'solve_system', input: { equations: lines.filter((l) => /=/.test(l)) } };
  }
  const equation = lines.find((l) => /=/.test(l) && /[a-z]/i.test(l));
  if (has('solve_equation') && equation) {
    return { name: 'solve_equation', input: { equation } };
  }
  const arithmetic = /([-\d\s+*/^().]+)/.exec(text.replace(/[?]/g, ''))?.[1]?.trim();
  if (has('calculate') && arithmetic && /\d/.test(arithmetic)) {
    return { name: 'calculate', input: { expression: arithmetic } };
  }
  return null;
}

/** Formats a reply from the real tool output. No numbers are invented here. */
function replyFromToolResult(name, data) {
  if (!data || data.error) {
    return `I could not compute that reliably, so I will not guess. ${data?.error ?? ''}`.trim();
  }
  switch (name) {
    case 'calculate': {
      const exact = data.exact ?? data.decimal;
      const line = data.isExact
        ? `$$${data.exactLatex ?? exact}$$`
        : `$$\\approx ${data.decimal}$$`;
      return [
        `**Result**`,
        ``,
        line,
        ``,
        data.isExact
          ? `That value is exact${data.decimalIsExact ? ` (${data.decimal} as a decimal).` : `; as a decimal it rounds to ${data.decimal}.`}`
          : `This is an approximation, not an exact value.`,
      ].join('\n');
    }
    case 'solve_equation': {
      const sols = (data.solutions ?? []).map((s) => s.latex).join(', ');
      const check = data.verification?.[0];
      return [
        `Let's work through $${data.normalizedLatex ?? ''}$.`,
        ``,
        `**Step 1.** ${data.details?.isolationStep ?? 'Isolate the variable.'}`,
        ``,
        `$$${data.variable} = ${sols || '\\text{no real solution}'}$$`,
        ``,
        check ? `**Check:** substituting back gives a residual of ${check.residual}, so the answer is verified.` : '',
        data.details?.discriminant ? `The discriminant is $${data.details.discriminant}$.` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'check_work': {
      if (data.allValid) return `Every line follows from the one before it. ${data.summary}`;
      const bad = data.lines?.[data.firstErrorIndex];
      return [
        `I found the first mistake.`,
        ``,
        `**Line ${data.firstErrorIndex + 1}:** $${bad?.lineLatex ?? ''}$`,
        ``,
        bad?.message ?? data.summary,
        ``,
        data.finalAnswerCheck
          ? `The correct answer is $${data.finalAnswerCheck.expected.join(', ')}$.`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'differentiate':
      return [
        `**Derivative**`,
        ``,
        `$$\\frac{d}{d${data.variable}}\\left(${data.input}\\right) = ${data.derivativeLatex}$$`,
        ``,
        `Rules used: ${(data.rulesUsed ?? []).join(', ')}.`,
        `Verified numerically at ${(data.checkedNumerically ?? []).length} points.`,
      ].join('\n');
    case 'integrate':
      return [
        `$$\\int ${data.input}\\,d${data.variable} = ${data.exactValue ?? data.approxValue}$$`,
        ``,
        data.isExact ? 'This value is exact.' : 'This value is a numerical approximation.',
      ].join('\n');
    case 'solve_system': {
      const entries = Object.entries(data.solution ?? {});
      return [
        `**Solution**`,
        ``,
        `$$${entries.map(([k, v]) => `${k} = ${v.latex}`).join(', \\quad ')}$$`,
      ].join('\n');
    }
    default:
      return `Here is what the computation returned:\n\n\`\`\`json\n${JSON.stringify(data).slice(0, 400)}\n\`\`\``;
  }
}

function streamText(res, text, { stopReason = 'end_turn', delayMs = 8 } = {}) {
  res.write(enc({ type: 'message_start', message: { usage: { input_tokens: 42 } } }));
  res.write(enc({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }));
  // Chunked so the client genuinely exercises incremental streaming.
  const chunks = text.match(/[\s\S]{1,24}/g) ?? [];
  let i = 0;
  const tick = () => {
    if (i < chunks.length) {
      res.write(enc({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: chunks[i++] } }));
      setTimeout(tick, delayMs);
      return;
    }
    res.write(enc({ type: 'content_block_stop', index: 0 }));
    res.write(enc({ type: 'message_delta', delta: { stop_reason: stopReason }, usage: { output_tokens: 120 } }));
    res.end();
  };
  tick();
}

function streamToolUse(res, name, input) {
  res.write(enc({ type: 'message_start', message: { usage: { input_tokens: 42 } } }));
  res.write(
    enc({
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'tool_use', id: `toolu_${Date.now()}`, name, input: {} },
    }),
  );
  const json = JSON.stringify(input);
  for (const part of json.match(/[\s\S]{1,20}/g) ?? []) {
    res.write(enc({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: part } }));
  }
  res.write(enc({ type: 'content_block_stop', index: 0 }));
  res.write(enc({ type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 30 } }));
  res.end();
}

export function startMockUpstream({ port = 0, failMode = null } = {}) {
  const state = { failMode, delayMs: 8 };

  const server = createServer((req, res) => {
    if (req.url === '/__fail') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        state.failMode = body.trim() || null;
        res.writeHead(200).end('ok');
      });
      return;
    }

    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      if (state.failMode === 'overloaded') {
        res.writeHead(529, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { type: 'overloaded_error', message: 'Service overloaded.' } }));
        return;
      }
      if (state.failMode === 'auth') {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { type: 'authentication_error', message: 'invalid x-api-key' } }));
        return;
      }

      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'bad json' } }));
        return;
      }

      const toolNames = (payload.tools ?? []).map((t) => t.name);
      const messages = payload.messages ?? [];

      // Non-streaming requests are the title endpoint.
      if (!payload.stream) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            content: [{ type: 'text', text: 'Solving a linear equation' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        );
        return;
      }

      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });

      // If the last message carries tool results, answer using those real values.
      const last = messages[messages.length - 1];
      const toolResults = Array.isArray(last?.content)
        ? last.content.filter((b) => b.type === 'tool_result')
        : [];
      if (toolResults.length) {
        const prior = messages[messages.length - 2];
        const use = Array.isArray(prior?.content) ? prior.content.find((b) => b.type === 'tool_use') : null;
        let data = null;
        try {
          data = JSON.parse(toolResults[0].content);
        } catch {
          data = null;
        }
        streamText(res, replyFromToolResult(use?.name ?? 'unknown', data), { delayMs: state.delayMs });
        return;
      }

      // Otherwise decide what to compute, using the student's newest message.
      const userText = messages
        .filter((m) => m.role === 'user')
        .flatMap((m) =>
          typeof m.content === 'string'
            ? [m.content]
            : m.content.filter((b) => b.type === 'text').map((b) => b.text),
        )
        .pop() ?? '';

      const isFollowUp = /why|how come|what about|explain|step/i.test(userText) && userText.length < 120;
      if (isFollowUp) {
        // Answer from conversation context to prove memory reaches the model.
        const earlier = messages
          .filter((m) => m.role === 'user')
          .flatMap((m) => (typeof m.content === 'string' ? [m.content] : []))
          .filter((c) => /=/.test(c));
        const problem = earlier[0] ?? 'the problem';
        streamText(
          res,
          // eslint-disable-next-line
          `You asked about $${problem.replace(/\$/g, '')}$. We subtracted 5 because it was added to the term containing $x$, and subtracting the same amount from both sides keeps the equation balanced while isolating $2x$.`,
        );
        return;
      }

      const plan = planToolCall(userText, toolNames);
      if (plan) streamToolUse(res, plan.name, plan.input);
      else streamText(res, 'Could you share the specific problem you are working on?', { delayMs: state.delayMs });
    });
  });

  return new Promise((resolvePromise) => {
    server.listen(port, () => {
      resolvePromise({
        server,
        port: server.address().port,
        url: `http://127.0.0.1:${server.address().port}`,
        setFailMode: (m) => {
          state.failMode = m;
        },
        /** Slows the stream so tests can reliably interact mid-generation. */
        setDelay: (ms) => {
          state.delayMs = ms;
        },
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startMockUpstream({ port: Number(process.env.PORT || 8788) }).then((s) =>
    console.log(`Mock upstream on ${s.url}`),
  );
}
