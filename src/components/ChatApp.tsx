'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Menu, Moon, PanelLeft, Sun, TriangleAlert } from './icons';
import { SubjectIcon } from './subject-icons';
import { Sidebar, type SubjectSummary } from './Sidebar';
import { MessageList } from './MessageList';
import { Composer } from './Composer';
import { CopyButton } from './CopyButton';
import { useChat } from '@/hooks/useChat';
import { useTheme } from '@/hooks/useTheme';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { conversationStore, loadSettings, saveSettings } from '@/lib/client/storage';
import { conversationToMarkdown } from '@/lib/client/markdown-export';
import { createId } from '@/lib/core/sse';
import type {
  ChatMessage,
  Conversation,
  ImageAttachment,
  StudentLevel,
  SubjectMode,
} from '@/lib/core/types';

interface PlatformSubject extends SubjectSummary {
  defaultMode: string;
  modes: SubjectMode[];
  suggestions: { label: string; prompt: string; mode?: string }[];
}

function newConversation(subjectId: string, mode: string, level: StudentLevel): Conversation {
  const now = Date.now();
  return {
    id: createId('conv'),
    subjectId,
    title: 'New conversation',
    messages: [],
    mode,
    level,
    createdAt: now,
    updatedAt: now,
  };
}

export function ChatApp() {
  const { toggle: toggleTheme } = useTheme();
  const isOnline = useOnlineStatus();

  const [subjects, setSubjects] = useState<PlatformSubject[]>([]);
  const [subjectId, setSubjectId] = useState('general');
  const [mode, setMode] = useState('chat');
  const [level, setLevel] = useState<StudentLevel>('auto');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );
  // The conversation actually on screen is the real source of truth for which
  // subject is showing -- not the last subject clicked in the sidebar, which
  // goes stale the moment an older conversation from a different subject is
  // opened from history. Falls back to the sidebar selection only when there
  // is no active conversation to defer to (a fresh app, or after a delete).
  const effectiveSubjectId = active?.subjectId ?? subjectId;
  const subject = useMemo(
    () => subjects.find((s) => s.id === effectiveSubjectId) ?? null,
    [subjects, effectiveSubjectId],
  );

  /* ------------------------------ bootstrap ------------------------------ */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const settings = loadSettings();
      setLevel(settings.level);

      try {
        const res = await fetch('/api/subjects');
        const data = (await res.json()) as { subjects: PlatformSubject[] };
        if (cancelled) return;
        setSubjects(data.subjects);
        const preferred =
          data.subjects.find((s) => s.id === settings.lastSubjectId && s.status === 'available') ??
          data.subjects.find((s) => s.status === 'available') ??
          null;
        if (preferred) {
          setSubjectId(preferred.id);
          setMode(
            preferred.modes.some((m) => m.id === settings.lastMode)
              ? settings.lastMode
              : preferred.defaultMode,
          );
        }
      } catch {
        if (!cancelled) {
          setSetupMessage('Could not load the subject list. Is the dev server running?');
        }
      }

      // Surface a missing API key immediately rather than on first send.
      try {
        const health = await fetch('/api/health').then((r) => r.json());
        if (!cancelled && !health.configured) setSetupMessage(health.message);
      } catch {
        /* health is advisory only */
      }

      const stored = await conversationStore.list();
      if (cancelled) return;
      setConversations(stored);
      setActiveId(stored[0]?.id ?? null);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveSettings({ ...loadSettings(), level, lastMode: mode, lastSubjectId: subjectId });
  }, [level, mode, subjectId, ready]);

  /* ---------------------------- conversation io --------------------------- */

  const persist = useCallback((conversation: Conversation) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== conversation.id);
      next.unshift(conversation);
      return next.sort((a, b) => b.updatedAt - a.updatedAt);
    });
    void conversationStore.save(conversation);
  }, []);

  const handleMessagesUpdate = useCallback(
    (messages: ChatMessage[]) => {
      setConversations((prev) => {
        const current = prev.find((c) => c.id === activeId);
        if (!current) return prev;
        const updated: Conversation = { ...current, messages, mode, level, updatedAt: Date.now() };
        void conversationStore.save(updated);
        return [updated, ...prev.filter((c) => c.id !== activeId)].sort(
          (a, b) => b.updatedAt - a.updatedAt,
        );
      });
    },
    [activeId, level, mode],
  );

  /** Auto-name a conversation from its first message; silent on failure. */
  const handleFirstMessage = useCallback(
    async (text: string) => {
      const id = activeId;
      if (!id) return;
      try {
        const res = await fetch('/api/title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectId, text }),
        });
        const data = (await res.json()) as { title: string | null };
        const title = data.title?.trim();
        if (!title) return;
        setConversations((prev) => {
          const current = prev.find((c) => c.id === id);
          if (!current || current.title !== 'New conversation') return prev;
          const updated = { ...current, title };
          void conversationStore.save(updated);
          return [updated, ...prev.filter((c) => c.id !== id)];
        });
      } catch {
        /* the fallback title is fine */
      }
    },
    [activeId, subjectId],
  );

  const chat = useChat({
    conversation: active,
    onUpdate: handleMessagesUpdate,
    onFirstMessage: handleFirstMessage,
  });

  /**
   * When the first message starts a new conversation, the send has to wait for
   * that conversation to become active. Sending immediately would race the
   * chat state reset that runs when the active conversation changes, and the
   * message would be discarded mid-stream.
   */
  const pendingSendRef = useRef<{ text: string; images: ImageAttachment[] } | null>(null);

  const handleSend = useCallback(
    (text: string, images: ImageAttachment[]) => {
      if (!active) {
        const created = newConversation(subjectId, mode, level);
        persist(created);
        setActiveId(created.id);
        pendingSendRef.current = { text, images };
        return;
      }
      void chat.send({
        text,
        images: images.length ? images : undefined,
        mode,
        level,
        subjectId: active.subjectId,
      });
    },
    [active, chat, level, mode, persist, subjectId],
  );

  useEffect(() => {
    const pending = pendingSendRef.current;
    if (!active || !pending) return;
    pendingSendRef.current = null;
    void chat.send({
      text: pending.text,
      images: pending.images.length ? pending.images : undefined,
      mode,
      level,
      subjectId: active.subjectId,
    });
    // Only re-run when the active conversation changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const handleNew = useCallback(() => {
    if (chat.isStreaming) chat.stop();
    const created = newConversation(effectiveSubjectId, mode, level);
    persist(created);
    setActiveId(created.id);
    setSidebarOpen(false);
  }, [chat, effectiveSubjectId, level, mode, persist]);

  const handleDelete = useCallback(
    (id: string) => {
      void conversationStore.remove(id);
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (id === activeId) setActiveId(next[0]?.id ?? null);
        return next;
      });
    },
    [activeId],
  );

  const handleRename = useCallback(
    (id: string, title: string) => {
      setConversations((prev) => {
        const current = prev.find((c) => c.id === id);
        if (!current) return prev;
        const updated = { ...current, title, updatedAt: current.updatedAt };
        void conversationStore.save(updated);
        return prev.map((c) => (c.id === id ? updated : c));
      });
    },
    [],
  );

  const modes = subject?.modes ?? [];
  const isEmpty = !active || active.messages.length === 0;

  return (
    <div data-print-flow className="flex h-[100dvh] overflow-hidden bg-surface text-ink">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        subjects={subjects}
        activeSubjectId={effectiveSubjectId}
        onSubjectChange={(id) => {
          if (id === effectiveSubjectId) {
            setSidebarOpen(false);
            return;
          }
          if (chat.isStreaming) chat.stop();
          const next = subjects.find((s) => s.id === id);
          if (!next) return;
          setSubjectId(id);
          // Resume the most recent conversation already in that subject
          // (conversations are kept sorted newest-first) rather than always
          // starting over -- switching subjects should feel like switching
          // to a different thread, not discarding one.
          const existing = conversations.find((c) => c.subjectId === id);
          if (existing) {
            setActiveId(existing.id);
            setMode(next.modes.some((m) => m.id === existing.mode) ? existing.mode : next.defaultMode);
          } else {
            setMode(next.defaultMode);
            const created = newConversation(id, next.defaultMode, level);
            persist(created);
            setActiveId(created.id);
          }
          setSidebarOpen(false);
        }}
        conversations={conversations}
        activeId={activeId}
        onSelect={(id) => {
          if (chat.isStreaming) chat.stop();
          const target = conversations.find((c) => c.id === id);
          if (target) {
            setSubjectId(target.subjectId);
            const targetSubject = subjects.find((s) => s.id === target.subjectId);
            setMode(
              targetSubject?.modes.some((m) => m.id === target.mode)
                ? target.mode
                : (targetSubject?.defaultMode ?? target.mode),
            );
          }
          setActiveId(id);
          setSidebarOpen(false);
        }}
        onNew={handleNew}
        onRename={handleRename}
        onDelete={handleDelete}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            data-print-hide
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-sunken lg:hidden"
          >
            <Menu size={18} />
          </button>
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle sidebar"
            data-print-hide
            className="hidden rounded-lg p-1.5 text-ink-muted hover:bg-surface-sunken lg:block"
          >
            <PanelLeft size={18} />
          </button>

          <h1 className="min-w-0 flex-1 truncate text-[14px] font-medium">
            {active?.title ?? subject?.name ?? 'Chat'}
          </h1>

          {!isEmpty && active && (
            <div data-print-hide className="flex items-center">
              <CopyButton
                value={() => conversationToMarkdown(active)}
                label="Copy conversation as Markdown"
                iconOnly
              />
              <button
                type="button"
                onClick={() => window.print()}
                aria-label="Export this conversation as a PDF"
                title="Export as PDF"
                className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-sunken"
              >
                <Download size={17} />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            data-print-hide
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-sunken"
          >
            <Sun size={17} className="hidden dark:block" />
            <Moon size={17} className="dark:hidden" />
          </button>
        </header>

        {/* Offline takes priority over the setup banner: it is the more
            urgent, more actionable problem, and both together would just be
            noise stacked in the same corner of the screen. */}
        {!isOnline ? (
          <div
            data-print-hide
            className="flex items-start gap-2 border-b border-amber-300/50 bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          >
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            <p>You&rsquo;re offline. Reconnect to keep chatting -- your conversations are saved on this device.</p>
          </div>
        ) : (
          setupMessage && (
            <div
              data-print-hide
              className="flex items-start gap-2 border-b border-amber-300/50 bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
            >
              <TriangleAlert size={15} className="mt-0.5 shrink-0" />
              <p>{setupMessage}</p>
            </div>
          )
        )}

        {isEmpty ? (
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-5 py-8 text-center sm:py-16">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white">
                <SubjectIcon icon={subject?.icon} size={24} />
              </div>
              <h2 className="text-[22px] font-semibold tracking-tight">How can I help?</h2>
              <p className="mt-2 max-w-md text-[14px] text-ink-muted">
                {subject?.description ?? 'Ask anything.'}
              </p>

              <div className="mt-6 grid w-full gap-2 sm:mt-8 sm:grid-cols-2">
                {(subject?.suggestions ?? []).map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => {
                      if (s.mode) setMode(s.mode);
                      handleSend(s.prompt, []);
                    }}
                    className="rounded-xl border border-line bg-surface-raised p-3 text-left transition hover:border-brand/50 hover:bg-surface-sunken"
                  >
                    <p className="text-[13px] font-medium">{s.label}</p>
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-muted">
                      {s.prompt.split('\n').filter(Boolean).join(' · ')}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <MessageList
            messages={chat.messages}
            streamingText={chat.streamingText}
            isStreaming={chat.isStreaming}
            activeToolCalls={chat.activeToolCalls}
            error={chat.error}
            onRegenerate={chat.regenerate}
            onRetry={chat.retry}
            subjectIcon={subject?.icon}
          />
        )}

        <Composer
          modes={modes}
          mode={mode}
          onModeChange={setMode}
          onSend={handleSend}
          onStop={chat.stop}
          isStreaming={chat.isStreaming}
          disabled={!ready || !subject || !isOnline}
        />
      </div>
    </div>
  );
}
