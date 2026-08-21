export type ErrorCode =
  | 'invalid_request'
  | 'missing_api_key'
  | 'rate_limited'
  | 'upstream_error'
  | 'upstream_overloaded'
  | 'timeout'
  | 'aborted'
  | 'unauthorized'
  | 'payload_too_large'
  | 'unknown_subject'
  | 'internal_error';

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  retryable: boolean;
  details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options: { status?: number; retryable?: boolean; details?: unknown } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = options.status ?? defaultStatus(code);
    this.retryable = options.retryable ?? defaultRetryable(code);
    this.details = options.details;
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, retryable: this.retryable, details: this.details } };
  }
}

function defaultStatus(code: ErrorCode): number {
  switch (code) {
    case 'invalid_request':
      return 400;
    case 'unauthorized':
      return 401;
    case 'payload_too_large':
      return 413;
    case 'rate_limited':
      return 429;
    case 'unknown_subject':
      return 404;
    case 'missing_api_key':
      return 500;
    case 'timeout':
      return 504;
    case 'upstream_overloaded':
      return 503;
    case 'upstream_error':
      return 502;
    default:
      return 500;
  }
}

function defaultRetryable(code: ErrorCode): boolean {
  return code === 'rate_limited' || code === 'timeout' || code === 'upstream_error' || code === 'upstream_overloaded';
}

/** Turns anything thrown into a user-safe AppError without leaking internals. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Error) {
    if (err.name === 'AbortError') return new AppError('aborted', 'Generation was stopped.', { status: 499 });
    return new AppError('internal_error', err.message || 'Something went wrong.');
  }
  return new AppError('internal_error', 'Something went wrong.');
}

/** Human-facing guidance attached to each failure mode. */
export function friendlyMessage(code: ErrorCode): string {
  switch (code) {
    case 'missing_api_key':
      return 'The server is missing its GROQ_API_KEY. Add it in Vercel under Settings -> Environment Variables, then redeploy.';
    case 'rate_limited':
      return 'Too many requests in a short time. Wait a moment and try again.';
    case 'upstream_overloaded':
      return 'The AI service is busy right now. Try again in a few seconds.';
    case 'timeout':
      return 'The request took too long. Try a shorter problem or send it again.';
    case 'aborted':
      return 'Generation stopped.';
    case 'payload_too_large':
      return 'That message or image is too large. Try a smaller image or shorter text.';
    default:
      return 'Something went wrong handling that request.';
  }
}
