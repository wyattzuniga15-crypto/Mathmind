'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createSseParser, createId } from '@/lib/core/sse';
import type {
  ChatMessage,
  Conversation,
  ImageAttachment,
  StreamEvent,
  StudentLevel,
  ToolCallRecord,
} from '@/lib/core/types';

export interface SendOptions {
  text: string;
  images?: ImageAttachment[];
  mode: string;
  level: StudentLevel;
  subjectId: string;
}

export interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  activeToolCalls: ToolCallRecord[];
  error: { message: string; retryable: boolean; code: string } | null;
}

interface UseChatArgs {
  conversation: Conversation | null;
  onUpdate: (messages: ChatMessage[]) => void;
  onFirstMessage?: (text: string) => void;
}

export function useChat({ conversation, onUpdate, onFirstMessage }: UseChatArgs) {
  const [messages, setMessages] = useState<ChatMessage[]>(conversation?.messages ?? []);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallRecord[]>([]);
  const [error, setError] = useState<ChatState['error']>(null);

  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const lastRequestRef = useRef<SendOptions | null>(null);

  useEffect(() => {
    const next = conversation?.messages ?? [];
    messagesRef.current = next;
    setMessages(next);
    setStreamingText('');
    setActiveToolCalls([]);
    setError(null);
  }, [conversation?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = useCallback(
    (next: ChatMessage[]) => {
      messagesRef.current = next;
      setMessages(next);
      onUpdate(next);
    },
    [onUpdate],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const runStream = useCallback(
    async (history: ChatMessage[], options: SendOptions) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      setStreamingText('');
      setActiveToolCalls([]);
      setError(null);

      let text = '';
      const toolCalls: ToolCallRecord[] = [];
      let failure: ChatState['error'] = null;

      const parser = createSseParser((event: StreamEvent) => {
        switch (event.type) {
          case 'text':
            text += event.delta;
            setStreamingText(text);
            break;
          case 'tool_call':
            toolCalls.push({ id: event.id, name: event.name, input: event.input });
            setActiveToolCalls([...toolCalls]);
            break;
          case 'tool_result': {
            const record = toolCalls.find((t) => t.id === event.id);
            if (record) {
              record.result = event.result;
              record.durationMs = event.durationMs;
            }
            setActiveToolCalls([...toolCalls]);
            break;
          }
          case 'error':
            failure = { message: event.message, retryable: event.retryable, code: event.code };
            break;
          default:
            break;
        }
      });

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            subjectId: options.subjectId,
            mode: options.mode,
            level: options.level,
            conversationId: conversation?.id,
            messages: history.map((m) => ({
              role: m.role,
              content: m.content,
              images: m.images?.filter((i) => i.data),
            })),
          }),
        });

        if (!response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
          const payload = await response.json().catch(() => null);
          failure = {
            message: payload?.error?.message ?? `Request failed with status ${response.status}.`,
            retryable: payload?.error?.retryable ?? response.status >= 500,
            code: payload?.error?.code ?? 'internal_error',
          };
        } else if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            parser.push(decoder.decode(value, { stream: true }));
          }
          parser.flush();
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          // Stopping is a user action, not a failure: keep whatever streamed in.
        } else {
          failure = {
            message: (err as Error).message || 'Could not reach the server.',
            retryable: true,
            code: 'network_error',
          };
        }
      }

      const assistant: ChatMessage = {
        id: createId('msg'),
        role: 'assistant',
        content: text,
        createdAt: Date.now(),
        toolCalls: toolCalls.length ? toolCalls : undefined,
        error: failure?.message,
      };

      abortRef.current = null;
      setIsStreaming(false);
      setStreamingText('');
      setActiveToolCalls([]);
      if (failure) setError(failure);

      // Only record an assistant turn if it produced something worth keeping.
      if (text.trim() || toolCalls.length) {
        commit([...history, assistant]);
      } else {
        commit(history);
      }
    },
    [commit, conversation?.id],
  );

  const send = useCallback(
    async (options: SendOptions) => {
      if (isStreaming) return;
      const trimmed = options.text.trim();
      if (!trimmed && !options.images?.length) return;

      const userMessage: ChatMessage = {
        id: createId('msg'),
        role: 'user',
        content: trimmed,
        images: options.images,
        createdAt: Date.now(),
      };
      const history = [...messagesRef.current, userMessage];
      commit(history);
      lastRequestRef.current = options;
      if (history.filter((m) => m.role === 'user').length === 1) {
        onFirstMessage?.(trimmed || 'Image problem');
      }
      await runStream(history, options);
    },
    [commit, isStreaming, onFirstMessage, runStream],
  );

  /** Drops the last assistant turn and re-runs the same request. */
  const regenerate = useCallback(async () => {
    if (isStreaming) return;
    const history = [...messagesRef.current];
    while (history.length && history[history.length - 1].role === 'assistant') history.pop();
    if (!history.length) return;
    const options = lastRequestRef.current;
    if (!options) return;
    commit(history);
    await runStream(history, options);
  }, [commit, isStreaming, runStream]);

  const retry = regenerate;

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    messages,
    isStreaming,
    streamingText,
    activeToolCalls,
    error,
    send,
    stop,
    regenerate,
    retry,
    clearError,
  };
}
