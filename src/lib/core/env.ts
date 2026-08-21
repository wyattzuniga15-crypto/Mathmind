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
  const apiKey = env('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new AppError(
      'missing_api_key',
      'ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local, add your key, and restart the server.',
    );
  }
  return {
    apiKey,
    apiBaseUrl: env('ANTHROPIC_BASE_URL') ?? 'https://api.anthropic.com',
    model: env('AI_MODEL') ?? 'claude-sonnet-4-5',
    fastModel: env('AI_FAST_MODEL') ?? env('AI_MODEL') ?? 'claude-haiku-4-5',
    maxTokens: intEnv('AI_MAX_TOKENS', 4096),
    requestTimeoutMs: intEnv('AI_TIMEOUT_MS', 120_000),
    maxToolIterations: intEnv('AI_MAX_TOOL_ITERATIONS', 6),
    rateLimitPerMinute: intEnv('RATE_LIMIT_PER_MINUTE', 20),
    rateLimitPerDay: intEnv('RATE_LIMIT_PER_DAY', 500),
    authRequired: env('AUTH_REQUIRED') === 'true',
  };
}

/** True when the server has everything it needs to answer chat requests. */
export function isConfigured(): boolean {
  return Boolean(env('ANTHROPIC_API_KEY'));
}
