'use client';

import type { Conversation, ChatMessage, StudentLevel } from '../core/types';

/**
 * Conversation storage behind an interface.
 *
 * localStorage is the right default for a single-device tutoring session with
 * no accounts. When persistent student progress arrives, implement
 * `ConversationStore` against your API and swap the instance — the UI only ever
 * touches this interface.
 */
export interface ConversationStore {
  list(): Promise<Conversation[]>;
  get(id: string): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

const KEY = 'tutor.conversations.v1';
const SETTINGS_KEY = 'tutor.settings.v1';
const MAX_STORED = 100;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Images are dropped before persisting: they are large and quickly blow the quota. */
function stripImages(conversation: Conversation): Conversation {
  return {
    ...conversation,
    messages: conversation.messages.map((m: ChatMessage) =>
      m.images?.length
        ? { ...m, images: m.images.map((i) => ({ ...i, data: '' })), content: m.content }
        : m,
    ),
  };
}

export class LocalConversationStore implements ConversationStore {
  private read(): Conversation[] {
    if (typeof window === 'undefined') return [];
    return safeParse<Conversation[]>(window.localStorage.getItem(KEY), []);
  }

  private write(list: Conversation[]) {
    if (typeof window === 'undefined') return;
    const trimmed = list
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_STORED)
      .map(stripImages);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(trimmed));
    } catch {
      // Quota exceeded: keep only the most recent conversations and retry once.
      try {
        window.localStorage.setItem(KEY, JSON.stringify(trimmed.slice(0, 20)));
      } catch {
        /* give up silently rather than breaking the session */
      }
    }
  }

  async list() {
    return this.read().sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async get(id: string) {
    return this.read().find((c) => c.id === id) ?? null;
  }
  async save(conversation: Conversation) {
    const list = this.read().filter((c) => c.id !== conversation.id);
    list.push(conversation);
    this.write(list);
  }
  async remove(id: string) {
    this.write(this.read().filter((c) => c.id !== id));
  }
  async clear() {
    this.write([]);
  }
}

export const conversationStore: ConversationStore = new LocalConversationStore();

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  level: StudentLevel;
  lastSubjectId: string;
  lastMode: string;
  showToolTrace: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  level: 'auto',
  lastSubjectId: 'math',
  lastMode: 'solve',
  showToolTrace: true,
};

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...safeParse<Partial<AppSettings>>(window.localStorage.getItem(SETTINGS_KEY), {}) };
}

export function saveSettings(settings: AppSettings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* non-critical */
  }
}
