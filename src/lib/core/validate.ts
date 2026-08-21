import { AppError } from './errors';
import type { ChatRole, ImageAttachment, StudentLevel } from './types';

/**
 * Request validation without a schema library, so the server stays
 * dependency-free and every rule is explicit and testable.
 */

export const LIMITS = {
  maxMessages: 100,
  maxMessageChars: 12_000,
  maxTotalChars: 120_000,
  maxImagesPerMessage: 4,
  maxImageBytes: 5 * 1024 * 1024,
  maxTitleChars: 120,
} as const;

const LEVELS: StudentLevel[] = ['elementary', 'middle', 'high', 'college', 'auto'];
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

export interface ValidatedChatRequest {
  subjectId: string;
  mode: string;
  level: StudentLevel;
  messages: { role: ChatRole; content: string; images?: ImageAttachment[] }[];
  memorySummary?: string;
  sessionNotes?: string[];
  conversationId?: string;
}

function fail(message: string, details?: unknown): never {
  throw new AppError('invalid_request', message, { details });
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string, { max, required = true }: { max?: number; required?: boolean } = {}): string {
  if (value === undefined || value === null) {
    if (required) fail(`${label} is required.`);
    return '';
  }
  if (typeof value !== 'string') fail(`${label} must be a string.`);
  if (max !== undefined && value.length > max) {
    throw new AppError('payload_too_large', `${label} is too long (${value.length} characters, limit ${max}).`);
  }
  return value;
}

/** Approximate byte size of a base64 payload without decoding it. */
export function base64Bytes(data: string): number {
  const clean = data.replace(/=+$/, '');
  return Math.floor((clean.length * 3) / 4);
}

function validateImages(value: unknown, index: number): ImageAttachment[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) fail(`messages[${index}].images must be an array.`);
  if (value.length > LIMITS.maxImagesPerMessage) {
    fail(`messages[${index}].images has ${value.length} items, limit is ${LIMITS.maxImagesPerMessage}.`);
  }
  return value.map((raw, i) => {
    const img = asObject(raw, `messages[${index}].images[${i}]`);
    const mediaType = asString(img.mediaType, `messages[${index}].images[${i}].mediaType`);
    if (!IMAGE_TYPES.includes(mediaType as (typeof IMAGE_TYPES)[number])) {
      fail(`Unsupported image type "${mediaType}". Use JPEG, PNG, GIF, or WebP.`);
    }
    let data = asString(img.data, `messages[${index}].images[${i}].data`);
    // tolerate data URLs from the browser
    const comma = data.indexOf(',');
    if (data.startsWith('data:') && comma !== -1) data = data.slice(comma + 1);
    if (!/^[A-Za-z0-9+/=\s]+$/.test(data)) fail(`messages[${index}].images[${i}].data must be base64.`);
    data = data.replace(/\s+/g, '');
    if (base64Bytes(data) > LIMITS.maxImageBytes) {
      throw new AppError(
        'payload_too_large',
        `Image ${i + 1} is larger than ${Math.round(LIMITS.maxImageBytes / 1024 / 1024)}MB. Try a smaller photo.`,
      );
    }
    return {
      data,
      mediaType: mediaType as ImageAttachment['mediaType'],
      name: typeof img.name === 'string' ? img.name.slice(0, 120) : undefined,
    };
  });
}

export function parseChatRequest(body: unknown): ValidatedChatRequest {
  const root = asObject(body, 'Request body');

  const subjectId = asString(root.subjectId, 'subjectId', { max: 64 });
  if (!/^[a-z0-9-]+$/.test(subjectId)) fail('subjectId may only contain lowercase letters, digits, and dashes.');

  const mode = asString(root.mode, 'mode', { max: 64 });
  if (!/^[a-z0-9-]+$/.test(mode)) fail('mode may only contain lowercase letters, digits, and dashes.');

  const levelRaw = root.level === undefined ? 'auto' : asString(root.level, 'level', { max: 32 });
  if (!LEVELS.includes(levelRaw as StudentLevel)) {
    fail(`level must be one of: ${LEVELS.join(', ')}.`);
  }

  if (!Array.isArray(root.messages)) fail('messages must be an array.');
  if (root.messages.length === 0) fail('messages cannot be empty.');
  if (root.messages.length > LIMITS.maxMessages) {
    fail(`messages has ${root.messages.length} items, limit is ${LIMITS.maxMessages}.`);
  }

  let totalChars = 0;
  const messages = root.messages.map((raw, index) => {
    const msg = asObject(raw, `messages[${index}]`);
    const role = asString(msg.role, `messages[${index}].role`, { max: 16 });
    if (role !== 'user' && role !== 'assistant') {
      fail(`messages[${index}].role must be "user" or "assistant".`);
    }
    const content = asString(msg.content, `messages[${index}].content`, {
      max: LIMITS.maxMessageChars,
      required: false,
    });
    const images = validateImages(msg.images, index);
    if (!content.trim() && !images?.length) {
      fail(`messages[${index}] must contain text or at least one image.`);
    }
    totalChars += content.length;
    return { role: role as ChatRole, content, images };
  });

  if (totalChars > LIMITS.maxTotalChars) {
    throw new AppError('payload_too_large', 'This conversation is too long to send. Start a new chat.');
  }
  if (messages[messages.length - 1].role !== 'user') {
    fail('The last message must come from the user.');
  }

  const sessionNotes = Array.isArray(root.sessionNotes)
    ? root.sessionNotes.filter((n): n is string => typeof n === 'string').slice(0, 20).map((n) => n.slice(0, 500))
    : undefined;

  return {
    subjectId,
    mode,
    level: levelRaw as StudentLevel,
    messages,
    memorySummary:
      typeof root.memorySummary === 'string' ? root.memorySummary.slice(0, 4000) : undefined,
    sessionNotes,
    conversationId: typeof root.conversationId === 'string' ? root.conversationId.slice(0, 64) : undefined,
  };
}

export function parseTitleRequest(body: unknown): { subjectId: string; text: string } {
  const root = asObject(body, 'Request body');
  return {
    subjectId: asString(root.subjectId, 'subjectId', { max: 64 }),
    text: asString(root.text, 'text', { max: 4000 }),
  };
}
