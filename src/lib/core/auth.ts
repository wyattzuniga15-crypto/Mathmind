import { AppError } from './errors';

/**
 * Identity resolution built so real auth can be dropped in later.
 *
 * Today every visitor gets a stable anonymous id derived from a cookie (or the
 * request fingerprint), which is enough for rate limiting and per-user storage
 * keys. To add real accounts, implement `AuthAdapter` and pass it to
 * `resolveIdentity` — routes and rate limiting keep working unchanged.
 */
export interface Identity {
  id: string;
  kind: 'anonymous' | 'user';
  displayName?: string;
  email?: string;
}

export interface AuthAdapter {
  /** Return null when the request carries no valid credentials. */
  verify(request: Request): Promise<Identity | null> | Identity | null;
}

export const ANON_COOKIE = 'tutor_anon_id';

/** Small non-cryptographic hash used only to bucket anonymous clients. */
export function fingerprint(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c + 1, 2246822519) >>> 0;
  }
  return (h1.toString(36) + h2.toString(36)).slice(0, 16);
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export interface ResolveOptions {
  adapter?: AuthAdapter | null;
  required?: boolean;
}

export async function resolveIdentity(
  request: Request,
  options: ResolveOptions = {},
): Promise<{ identity: Identity; setCookie?: string }> {
  if (options.adapter) {
    const identity = await options.adapter.verify(request);
    if (identity) return { identity };
    if (options.required) {
      throw new AppError('unauthorized', 'Sign in to continue.');
    }
  } else if (options.required) {
    throw new AppError(
      'unauthorized',
      'Authentication is required but no auth adapter is configured on the server.',
    );
  }

  const existing = readCookie(request, ANON_COOKIE);
  if (existing && /^[a-z0-9]{6,32}$/i.test(existing)) {
    return { identity: { id: existing, kind: 'anonymous' } };
  }

  const seed = [
    request.headers.get('x-forwarded-for') ?? '',
    request.headers.get('user-agent') ?? '',
    Math.random().toString(36),
  ].join('|');
  const id = fingerprint(seed);
  return {
    identity: { id, kind: 'anonymous' },
    setCookie: `${ANON_COOKIE}=${id}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`,
  };
}

/**
 * Identifier used for rate limiting.
 *
 * Anonymous callers are bucketed by request origin (IP + user agent) rather
 * than by their cookie id. A client that simply drops the cookie would
 * otherwise get a brand-new identity on every request and never hit a limit.
 */
export function clientKey(request: Request, identity: Identity): string {
  if (identity.kind === 'user') return `user:${identity.id}`;
  const ip = (request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? '')
    .split(',')[0]
    .trim();
  const agent = request.headers.get('user-agent') ?? '';
  return `anon:${fingerprint(`${ip}|${agent}`)}`;
}
