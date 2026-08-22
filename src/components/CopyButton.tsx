'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy } from './icons';

interface Props {
  value: string | (() => string);
  label?: string;
  subtle?: boolean;
  /** Icon only, no label text -- for slotting into a row of icon buttons (a header). */
  iconOnly?: boolean;
}

export function CopyButton({ value, label = 'Copy', subtle, iconOnly }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = useCallback(async () => {
    // Accepting a thunk lets a caller with an expensive value (rendering an
    // entire conversation to Markdown) skip the work on every render and pay
    // for it only when the button is actually clicked.
    const text = typeof value === 'function' ? value() : value;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard API needs a secure context; fall back to a selection copy.
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand('copy');
        setCopied(true);
      } catch {
        /* nothing more we can do */
      }
      document.body.removeChild(el);
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : label}
      title={label}
      className={
        iconOnly
          ? 'rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-sunken'
          : subtle
            ? 'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-ink-faint transition hover:bg-surface hover:text-ink'
            : 'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink-muted transition hover:bg-surface-sunken hover:text-ink'
      }
    >
      {copied ? <Check size={iconOnly ? 17 : 13} className="text-emerald-500" /> : <Copy size={iconOnly ? 17 : 13} />}
      {!iconOnly && <span>{copied ? 'Copied' : label}</span>}
    </button>
  );
}
