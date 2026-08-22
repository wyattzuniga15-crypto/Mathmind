'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, RefreshCw, TriangleAlert, User } from './icons';
import { SubjectIcon } from './subject-icons';
import { MarkdownMath } from './MarkdownMath';
import { CopyButton } from './CopyButton';
import { ToolTrace } from './ToolTrace';
import type { ChatMessage, ToolCallRecord } from '@/lib/core/types';

interface Props {
  messages: ChatMessage[];
  streamingText: string;
  isStreaming: boolean;
  activeToolCalls: ToolCallRecord[];
  error: { message: string; retryable: boolean; code: string; retryAfter?: number } | null;
  onRegenerate: () => void;
  onRetry: () => void;
  /** The active subject's icon key, so the assistant avatar matches it. */
  subjectIcon?: string;
}

/**
 * Retry, but only once retrying can actually work.
 *
 * A rate limit says how long the wait is. Without that on screen, the button
 * invites hammering it and burning the quota that's already exhausted, so
 * count it down and keep the button out of reach until it is worth pressing.
 */
function RetryButton({
  error,
  onRetry,
}: {
  error: { retryAfter?: number };
  onRetry: () => void;
}) {
  const [remaining, setRemaining] = useState(error.retryAfter ?? 0);

  useEffect(() => {
    setRemaining(error.retryAfter ?? 0);
    if (!error.retryAfter) return;
    const timer = setInterval(() => {
      setRemaining((seconds) => (seconds <= 1 ? 0 : seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [error.retryAfter]);

  const waiting = remaining > 0;

  return (
    <button
      type="button"
      onClick={onRetry}
      disabled={waiting}
      className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/50 px-2 py-1 text-xs font-medium transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent dark:hover:bg-amber-500/20"
    >
      <RefreshCw size={12} />
      {waiting ? `Try again in ${remaining}s` : 'Try again'}
    </button>
  );
}

function Avatar({ role, subjectIcon }: { role: 'user' | 'assistant'; subjectIcon?: string }) {
  return (
    <div
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
        role === 'assistant' ? 'bg-brand text-white' : 'bg-surface-sunken text-ink-muted'
      }`}
      aria-hidden
    >
      {role === 'assistant' ? <SubjectIcon icon={subjectIcon} size={15} /> : <User size={15} />}
    </div>
  );
}

export function MessageList({
  messages,
  streamingText,
  isStreaming,
  activeToolCalls,
  error,
  onRegenerate,
  onRetry,
  subjectIcon,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  // Mirrors pinnedRef into render-visible state: the ref alone drives the
  // auto-follow effect below without triggering a render on every scroll
  // pixel, but showing/hiding the jump button needs an actual re-render.
  const [pinned, setPinned] = useState(true);

  // Follow the stream, but stop following the moment the student scrolls up.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      pinnedRef.current = atBottom;
      setPinned(atBottom);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (pinnedRef.current) endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, streamingText, activeToolCalls.length]);

  const jumpToLatest = () => {
    pinnedRef.current = true;
    setPinned(true);
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  };

  const lastAssistantIndex = messages.map((m) => m.role).lastIndexOf('assistant');

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={containerRef} data-print-flow className="h-full overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          {messages.map((message, index) => {
            const isAssistant = message.role === 'assistant';
            return (
              <article key={message.id} className="mb-7 animate-fade-up">
                <div className="flex gap-3">
                  <Avatar role={message.role} subjectIcon={subjectIcon} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                      {isAssistant ? 'Assistant' : 'You'}
                    </div>

                    {message.images?.some((i) => i.data) && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {message.images
                          .filter((i) => i.data)
                          .map((img, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={i}
                              src={`data:${img.mediaType};base64,${img.data}`}
                              alt={img.name ?? 'Attached problem'}
                              className="max-h-56 rounded-lg border border-line object-contain"
                            />
                          ))}
                      </div>
                    )}

                    {isAssistant && message.toolCalls?.length ? (
                      <ToolTrace toolCalls={message.toolCalls} />
                    ) : null}

                    {isAssistant ? (
                      <MarkdownMath content={message.content} />
                    ) : (
                      <div className="whitespace-pre-wrap break-words rounded-xl bg-surface-sunken px-3.5 py-2.5 text-[15px] leading-relaxed">
                        {message.content}
                      </div>
                    )}

                    {message.error && message.error !== error?.message && (
                      <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-amber-600 dark:text-amber-400">
                        <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                        {message.error}
                      </p>
                    )}

                    {isAssistant && !isStreaming && message.content && (
                      <div data-print-hide className="mt-1.5 flex items-center gap-1">
                        <CopyButton value={message.content} />
                        {index === lastAssistantIndex && (
                          <button
                            type="button"
                            onClick={onRegenerate}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
                          >
                            <RefreshCw size={13} />
                            Regenerate
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {isStreaming && (
            <article className="mb-7">
              <div className="flex gap-3">
                <Avatar role="assistant" subjectIcon={subjectIcon} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                    Assistant
                  </div>
                  {activeToolCalls.length > 0 && <ToolTrace toolCalls={activeToolCalls} live />}
                  {streamingText ? (
                    <MarkdownMath content={streamingText} streaming />
                  ) : activeToolCalls.length === 0 ? (
                    <div className="flex items-center gap-1.5 py-1" aria-label="Thinking">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 animate-blink rounded-full bg-ink-faint"
                          style={{ animationDelay: `${i * 0.18}s` }}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          )}

          {error && !isStreaming && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-2.5 rounded-xl border border-amber-300/60 bg-amber-50 px-3.5 py-3 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
            >
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="break-words">{error.message}</p>
                {error.retryable && <RetryButton error={error} onRetry={onRetry} />}
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {!pinned && messages.length > 0 && (
        <button
          type="button"
          onClick={jumpToLatest}
          data-print-hide
          aria-label="Jump to the latest message"
          className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-surface-raised px-3 py-1.5 text-xs font-medium shadow-lg transition hover:bg-surface-sunken"
        >
          <ChevronDown size={14} />
          Jump to latest
        </button>
      )}
    </div>
  );
}
