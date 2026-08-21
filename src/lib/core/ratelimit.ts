import { AppError } from './errors';

/**
 * Token-bucket rate limiting behind a store interface.
 *
 * The in-memory store is right for a single dev/preview instance. Swapping in
 * Redis for production means implementing `RateLimitStore` and passing it to
 * `createRateLimiter` — no caller changes.
 */
export interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface RateLimitStore {
  get(key: string): Promise<RateLimitRecord | undefined> | RateLimitRecord | undefined;
  set(key: string, value: RateLimitRecord): Promise<void> | void;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private map = new Map<string, RateLimitRecord>();
  private lastSweep = 0;

  get(key: string) {
    this.sweep();
    return this.map.get(key);
  }
  set(key: string, value: RateLimitRecord) {
    this.map.set(key, value);
  }
  private sweep() {
    const now = Date.now();
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [k, v] of this.map) if (v.resetAt <= now) this.map.delete(k);
  }
}

export interface RateLimitRule {
  name: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  rule: RateLimitRule;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export function createRateLimiter(store: RateLimitStore = new MemoryRateLimitStore()) {
  return {
    async check(identity: string, rules: RateLimitRule[]): Promise<RateLimitResult> {
      const now = Date.now();
      let tightest: RateLimitResult | null = null;

      for (const rule of rules) {
        const key = `${rule.name}:${identity}`;
        const existing = await store.get(key);
        const record =
          existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + rule.windowMs };
        record.count += 1;
        await store.set(key, record);

        const remaining = Math.max(0, rule.limit - record.count);
        const result: RateLimitResult = {
          allowed: record.count <= rule.limit,
          rule,
          remaining,
          resetAt: record.resetAt,
          retryAfterSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
        };
        if (!result.allowed) return result;
        if (!tightest || remaining < tightest.remaining) tightest = result;
      }

      return (
        tightest ?? {
          allowed: true,
          rule: rules[0] ?? { name: 'none', limit: Infinity, windowMs: 0 },
          remaining: Infinity,
          resetAt: now,
          retryAfterSeconds: 0,
        }
      );
    },
  };
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.rule.limit),
    'X-RateLimit-Remaining': String(Number.isFinite(result.remaining) ? result.remaining : 0),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    ...(result.allowed ? {} : { 'Retry-After': String(result.retryAfterSeconds) }),
  };
}

export function assertAllowed(result: RateLimitResult): void {
  if (result.allowed) return;
  throw new AppError(
    'rate_limited',
    `Rate limit reached (${result.rule.limit} requests per ${Math.round(result.rule.windowMs / 1000)}s). Try again in ${result.retryAfterSeconds}s.`,
  );
}

/** Shared limiter instance for API routes. */
export const rateLimiter = createRateLimiter();
