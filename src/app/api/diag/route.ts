import '@/lib/subjects';
import { getSubject } from '@/lib/core/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Self-diagnosis endpoint.
 *
 * Open /api/diag in a browser and it reports exactly where the pipeline is
 * broken: missing key, bad model ID, no tool-calling support, or a provider
 * error. Everything runs server-side.
 *
 * SAFETY: never returns the API key or any part of it — only whether one is
 * present, and its length. Values of secrets are never echoed.
 */

interface Step {
  step: string;
  ok: boolean;
  detail: string;
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : undefined;
}

export async function GET() {
  const steps: Step[] = [];
  const started = Date.now();

  const apiKey = env('GROQ_API_KEY');
  const baseUrl = env('GROQ_BASE_URL') ?? 'https://api.groq.com/openai/v1';
  const model = env('GROQ_MODEL') ?? 'openai/gpt-oss-120b';

  steps.push({
    step: '1. API key present',
    ok: Boolean(apiKey),
    detail: apiKey
      ? `GROQ_API_KEY is set (${apiKey.length} characters, starts "${apiKey.slice(0, 4)}")`
      : 'GROQ_API_KEY is NOT set. Add it in Vercel > Settings > Environment Variables, then redeploy.',
  });

  steps.push({
    step: '2. Configuration',
    ok: true,
    detail: `model="${model}"  baseUrl="${baseUrl}"  (set GROQ_MODEL to override)`,
  });

  let toolsCount = 0;
  try {
    toolsCount = getSubject('math').tools.length;
    steps.push({
      step: '3. Math engine tools loaded',
      ok: toolsCount > 0,
      detail: `${toolsCount} deterministic tools registered`,
    });
  } catch (e) {
    steps.push({ step: '3. Math engine tools loaded', ok: false, detail: String((e as Error).message) });
  }

  if (!apiKey) {
    return Response.json({ ok: false, summary: 'No API key configured.', steps }, { status: 200 });
  }

  // 3b. Which models can this key actually reach? Groq retires IDs on a
  //     schedule, so a hardcoded list in the docs goes stale; ask the provider.
  let availableModels: string[] = [];
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: Array<{ id?: string }> };
      availableModels = (json.data ?? [])
        .map((m) => m.id)
        .filter((id): id is string => typeof id === 'string')
        .sort();
    }
    steps.push({
      step: '3b. Models available to this key',
      ok: availableModels.length > 0,
      detail: availableModels.length
        ? `${availableModels.length} models: ${availableModels.join(', ')}`
        : `Could not list models (HTTP ${res.status}). The key may be invalid.`,
    });
    if (availableModels.length && !availableModels.includes(model)) {
      steps.push({
        step: '3c. Configured model is available',
        ok: false,
        detail: `GROQ_MODEL is "${model}", which is not in the list above. It was probably retired. Set GROQ_MODEL to one of the listed IDs and redeploy.`,
      });
    }
  } catch (e) {
    steps.push({
      step: '3b. Models available to this key',
      ok: false,
      detail: `Could not list models: ${(e as Error).message}`,
    });
  }

  // 4. Can we reach the provider and is the model ID valid?
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
        max_tokens: 16,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const text = await res.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      const message =
        (parsed?.error as { message?: string } | undefined)?.message ?? text.slice(0, 300);
      steps.push({
        step: '4. Provider reachable / model valid',
        ok: false,
        detail: `HTTP ${res.status}: ${message}${
          res.status === 404
            ? '  -> The model ID does not exist. Check console.groq.com/docs/models for a current ID and set GROQ_MODEL.'
            : res.status === 401
              ? '  -> The API key was rejected. Generate a new one at console.groq.com/keys.'
              : ''
        }`,
      });
      return Response.json(
        { ok: false, summary: `Provider call failed with HTTP ${res.status}.`, steps },
        { status: 200 },
      );
    }

    const choice = (parsed?.choices as Array<Record<string, unknown>> | undefined)?.[0];
    const message = choice?.message as { content?: string; reasoning?: string } | undefined;
    steps.push({
      step: '4. Provider reachable / model valid',
      ok: true,
      detail: `HTTP 200. content=${JSON.stringify(message?.content ?? null)} reasoning=${
        message?.reasoning ? `${message.reasoning.length} chars` : 'none'
      }`,
    });

    if (!message?.content && message?.reasoning) {
      steps.push({
        step: '4b. WARNING',
        ok: false,
        detail:
          'This model returned reasoning but no content. That is the classic cause of blank answers.',
      });
    }
  } catch (e) {
    steps.push({
      step: '4. Provider reachable / model valid',
      ok: false,
      detail: `Request failed: ${(e as Error).message}`,
    });
    return Response.json({ ok: false, summary: 'Could not reach the provider.', steps }, { status: 200 });
  }

  // 5. Does the model actually support tool calling? The app depends on it.
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 256,
        messages: [
          { role: 'system', content: 'Use the calculate tool for any arithmetic. Do not compute it yourself.' },
          { role: 'user', content: 'What is 127 * 43?' },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'calculate',
              description: 'Evaluate an arithmetic expression exactly.',
              parameters: {
                type: 'object',
                properties: { expression: { type: 'string', description: 'e.g. "127*43"' } },
                required: ['expression'],
              },
            },
          },
        ],
        tool_choice: 'auto',
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const text = await res.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      const message =
        (parsed?.error as { message?: string } | undefined)?.message ?? text.slice(0, 300);
      steps.push({
        step: '5. Model supports tool calling',
        ok: false,
        detail: `HTTP ${res.status}: ${message}  -> This model cannot use tools. The math engine requires it. Pick a tool-capable model.`,
      });
    } else {
      const choice = (parsed?.choices as Array<Record<string, unknown>> | undefined)?.[0];
      const msg = choice?.message as
        | { content?: string; tool_calls?: Array<{ function?: { name?: string } }> }
        | undefined;
      const calls = msg?.tool_calls ?? [];
      steps.push({
        step: '5. Model supports tool calling',
        ok: calls.length > 0,
        detail:
          calls.length > 0
            ? `Model requested tool "${calls[0]?.function?.name}". Tool calling works.`
            : `Model answered without calling a tool (finish_reason=${String(
                choice?.finish_reason,
              )}). The math engine would be bypassed.`,
      });
    }
  } catch (e) {
    steps.push({
      step: '5. Model supports tool calling',
      ok: false,
      detail: `Request failed: ${(e as Error).message}`,
    });
  }

  const ok = steps.every((s) => s.ok);
  return Response.json(
    {
      ok,
      summary: ok
        ? 'All checks passed. The chat endpoint should work.'
        : 'One or more checks failed. See the first item with "ok": false.',
      elapsedMs: Date.now() - started,
      steps,
    },
    { status: 200 },
  );
}
