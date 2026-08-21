'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, ImagePlus, Square, X } from './icons';
import type { ImageAttachment, SubjectMode } from '@/lib/core/types';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

interface Props {
  modes: SubjectMode[];
  mode: string;
  onModeChange: (mode: string) => void;
  onSend: (text: string, images: ImageAttachment[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

async function fileToAttachment(file: File): Promise<ImageAttachment> {
  const data: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
  return { data, mediaType: file.type as ImageAttachment['mediaType'], name: file.name };
}

export function Composer({
  modes,
  mode,
  onModeChange,
  onSend,
  onStop,
  isStreaming,
  disabled,
  placeholder,
}: Props) {
  const [text, setText] = useState('');
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Grow with content, but stop before the composer eats the conversation.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    setUploadError(null);
    const accepted: ImageAttachment[] = [];
    for (const file of Array.from(files).slice(0, 4)) {
      if (!ALLOWED.includes(file.type)) {
        setUploadError(`${file.name} is not a supported image (use JPEG, PNG, GIF, or WebP).`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setUploadError(`${file.name} is larger than 5MB. Try a smaller photo.`);
        continue;
      }
      try {
        accepted.push(await fileToAttachment(file));
      } catch (e) {
        setUploadError((e as Error).message);
      }
    }
    if (accepted.length) setImages((prev) => [...prev, ...accepted].slice(0, 4));
  }, []);

  const submit = useCallback(() => {
    if (disabled || isStreaming) return;
    if (!text.trim() && !images.length) return;
    onSend(text, images);
    setText('');
    setImages([]);
    setUploadError(null);
  }, [disabled, images, isStreaming, onSend, text]);

  const activeMode = modes.find((m) => m.id === mode);

  return (
    <div className="border-t border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto w-full max-w-3xl px-3 pb-3 pt-2.5 sm:px-6 sm:pb-4">
        <div
          className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1"
          role="tablist"
          aria-label="Tutoring mode"
        >
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={m.id === mode}
              title={m.description}
              onClick={() => onModeChange(m.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition ${
                m.id === mode
                  ? 'bg-brand text-white shadow-sm'
                  : 'border border-line bg-surface-raised text-ink-muted hover:text-ink'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {images.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:${img.mediaType};base64,${img.data}`}
                  alt={img.name ?? 'Attachment'}
                  className="h-16 w-16 rounded-lg border border-line object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Remove ${img.name ?? 'image'}`}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-ink p-0.5 text-surface shadow"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {uploadError && (
          <p role="alert" className="mb-1.5 text-xs text-amber-600 dark:text-amber-400">
            {uploadError}
          </p>
        )}

        <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface-raised p-1.5 focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-brand/15">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={disabled}
            aria-label="Attach a photo of a problem"
            title="Attach a photo of a problem"
            className="rounded-xl p-2 text-ink-faint transition hover:bg-surface-sunken hover:text-ink disabled:opacity-40"
          >
            <ImagePlus size={18} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={ALLOWED.join(',')}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = '';
            }}
          />

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files).filter((f) => ALLOWED.includes(f.type));
              if (files.length) {
                e.preventDefault();
                void addFiles(files);
              }
            }}
            rows={1}
            disabled={disabled}
            placeholder={placeholder ?? activeMode?.hint ?? 'Ask a math question…'}
            aria-label="Message"
            className="max-h-[220px] min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-relaxed outline-none placeholder:text-ink-faint disabled:opacity-50"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className="rounded-xl bg-ink p-2.5 text-surface transition hover:opacity-90"
            >
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={disabled || (!text.trim() && !images.length)}
              aria-label="Send message"
              className="rounded-xl bg-brand p-2.5 text-white transition hover:opacity-90 disabled:opacity-30"
            >
              <ArrowUp size={16} />
            </button>
          )}
        </div>

        <p className="mt-1.5 hidden text-center text-[11px] text-ink-faint sm:block">
          Enter to send · Shift+Enter for a new line · every calculation is checked by an exact math engine
        </p>
      </div>
    </div>
  );
}
