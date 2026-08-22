import { AppError } from './errors';

/**
 * Server-only configuration.
 *
 * Nothing here is prefixed with NEXT_PUBLIC_, so none of it can be bundled
 * into client JavaScript. The API key is read at request time on the server.
 */
export interface ServerConfig {
  apiKey: string;
  apiBaseUrl: string;
  model: string;
  fastModel: string;
  maxTokens: number;
  requestTimeoutMs: number;
  maxToolIterations: number;
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  authRequired: boolean;
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : undefined;
}

function intEnv(name: string, fallback: number): number {
  const raw = env(name);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getServerConfig(): ServerConfig {
  const apiKey = env('GROQ_API_KEY');
  if (!apiKey) {
    throw new AppError(
      'missing_api_key',
      'GROQ_API_KEY is not set. Add it in Vercel under Settings -> Environment Variables, then redeploy.',
    );
  }
  return {
    apiKey,
    apiBaseUrl: env('GROQ_BASE_URL') ?? 'https://api.groq.com/openai/v1',
    // Groq retires model IDs regularly, so both are overridable without a code
    // change. These defaults are the current tool-calling production models.
    model: env('GROQ_MODEL') ?? 'openai/gpt-oss-120b',
    fastModel: env('GROQ_FAST_MODEL') ?? env('GROQ_MODEL') ?? 'openai/gpt-oss-20b',
    // Groq bills this reservation against your tokens-per-minute quota even
    // when the reply is far shorter, so it is a real per-call cost and not just
    // a ceiling. With the narrowed tool payload a call costs roughly 1600
    // tokens of input, so 1024 leaves room for three tool round-trips inside an
    // 8000 TPM budget (3 x 2624 = 7872) -- enough for a multi-part problem.
    // That is the trade being made: raising this buys longer answers and costs
    // round-trips. Raise it on a paid tier, where the quota does not bind.
    maxTokens: intEnv('AI_MAX_TOKENS', 1024),
    // Must stay under the platform function limit (60s on Vercel Hobby) so the
    // request fails with a readable error rather than being killed mid-stream.
    requestTimeoutMs: intEnv('AI_TIMEOUT_MS', 50_000),
    maxToolIterations: intEnv('AI_MAX_TOOL_ITERATIONS', 4),
    rateLimitPerMinute: intEnv('RATE_LIMIT_PER_MINUTE', 20),
    rateLimitPerDay: intEnv('RATE_LIMIT_PER_DAY', 500),
    authRequired: env('AUTH_REQUIRED') === 'true',
  };
}

/** True when the server has everything it needs to answer chat requests. */
export function isConfigured(): boolean {
  return Boolean(env('GROQ_API_KEY'));
}
