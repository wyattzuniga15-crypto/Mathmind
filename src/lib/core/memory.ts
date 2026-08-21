import type { ChatMessage, ImageAttachment } from './types';
import type { ApiMessage, ContentBlock } from './ai/client';

/**
 * Conversation memory.
 *
 * Two jobs:
 *  1. Keep the transcript inside a token budget without losing the thread.
 *  2. Surface an explicit "current problem" note so a follow-up like
 *     "why did you subtract 5?" resolves to the right problem and step.
 */

export interface MemoryOptions {
  /** Rough character budget for the transcript (~4 chars per token). */
  charBudget?: number;
  /** Always keep at least this many recent messages verbatim. */
  keepRecent?: number;
}

export interface BuiltContext {
  messages: ApiMessage[];
  droppedCount: number;
  sessionNotes: string[];
  /** Text of the problem the student is currently working on, if detectable. */
  activeProblem: string | null;
}

const DEFAULTS = { charBudget: 48_000, keepRecent: 8 };

/** Anything that looks like math: digits with operators, or an equation. */
const MATH_LINE = /[0-9a-zA-Z)\]]\s*(?:[+\-*/^=<>]|\\frac|\\sqrt)\s*[0-9a-zA-Z(\\[-]|=/;

export function looksLikeMath(text: string): boolean {
  return MATH_LINE.test(text);
}

/** Extracts the most recent line that reads like a stated problem. */
export function findActiveProblem(messages: Pick<ChatMessage, 'role' | 'content' | 'images'>[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'user') continue;
    if (m.images?.length && !m.content.trim()) return '(a problem the student uploaded as an image)';
    const lines = m.content.split('\n').map((l) => l.trim()).filter(Boolean);
    const mathLines = lines.filter(looksLikeMath);
    if (mathLines.length) return mathLines.join(' ; ').slice(0, 400);
    // a follow-up like "what about step 3?" keeps looking further back
    if (lines.length && lines.join(' ').length > 80) return lines.join(' ').slice(0, 400);
  }
  return null;
}

/** True when the newest message only makes sense with earlier context. */
export function isFollowUp(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length > 160) return false;
  return /^(what about|why|how come|and |but |explain (that|this|it|step)|step \d|that step|the (last|previous|second|third|first) (step|line|part)|i (don'?t|do not) (get|understand)|again|simpler|show me|can you|what did you|where did)/.test(
    t,
  );
}

export function buildSessionNotes(
  messages: Pick<ChatMessage, 'role' | 'content' | 'images'>[],
  extra: string[] = [],
): string[] {
  const notes = [...extra];
  const active = findActiveProblem(messages);
  if (active) notes.unshift(`Current problem the student is working on: ${active}`);
  const last = messages[messages.length - 1];
  if (last && last.role === 'user' && isFollowUp(last.content)) {
    notes.push(
      'The student just asked a follow-up question that refers to your previous explanation. Resolve pronouns and phrases like "step 3", "that step", or "why did you subtract 5" against the solution you already gave, and do not restate the whole problem from scratch.',
    );
  }
  return notes;
}

function toApiContent(message: Pick<ChatMessage, 'role' | 'content' | 'images'>): string | ContentBlock[] {
  if (!message.images?.length) return message.content;
  const blocks: ContentBlock[] = message.images.map((img: ImageAttachment) => ({
    type: 'image',
    source: { type: 'base64', media_type: img.mediaType, data: img.data },
  }));
  if (message.content.trim()) blocks.push({ type: 'text', text: message.content });
  else blocks.push({ type: 'text', text: 'Please read the math problem in this image and help me with it.' });
  return blocks;
}

function sizeOf(message: Pick<ChatMessage, 'content' | 'images'>): number {
  const images = (message.images ?? []).reduce((a, i) => a + i.data.length / 3, 0);
  return message.content.length + images;
}

/**
 * Builds the API message list, dropping the oldest turns when the budget is
 * exceeded. Images are stripped from older turns first because they dominate
 * the payload while contributing little once they have been described.
 */
export function buildContext(
  messages: Pick<ChatMessage, 'role' | 'content' | 'images'>[],
  options: MemoryOptions = {},
): BuiltContext {
  const charBudget = options.charBudget ?? DEFAULTS.charBudget;
  const keepRecent = options.keepRecent ?? DEFAULTS.keepRecent;

  const working = messages.map((m, i) => ({
    ...m,
    images: i < messages.length - 2 ? undefined : m.images,
  }));

  let total = working.reduce((a, m) => a + sizeOf(m), 0);
  let start = 0;
  while (total > charBudget && working.length - start > keepRecent) {
    total -= sizeOf(working[start]);
    start++;
  }

  // never begin the transcript with an assistant turn
  while (start < working.length - 1 && working[start].role === 'assistant') {
    total -= sizeOf(working[start]);
    start++;
  }

  const kept = working.slice(start);
  return {
    messages: kept.map((m) => ({ role: m.role, content: toApiContent(m) })),
    droppedCount: start,
    sessionNotes: buildSessionNotes(messages),
    activeProblem: findActiveProblem(messages),
  };
}

/** Compact summary of dropped turns, injected into the system prompt. */
export function summarizeDropped(
  messages: Pick<ChatMessage, 'role' | 'content'>[],
  count: number,
): string | undefined {
  if (count <= 0) return undefined;
  const dropped = messages.slice(0, count);
  const problems = dropped
    .filter((m) => m.role === 'user' && looksLikeMath(m.content))
    .map((m) => m.content.split('\n')[0].trim().slice(0, 120));
  const unique = [...new Set(problems)].slice(-8);
  if (!unique.length) return `Earlier in this session there were ${count} messages that are no longer shown in full.`;
  return `Earlier in this session (${count} messages not shown in full) the student worked on: ${unique.join(' | ')}.`;
}
