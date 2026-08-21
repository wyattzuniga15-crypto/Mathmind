'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy } from './icons';

interface Props {
  value: string;
  label?: string;
  subtle?: boolean;
}

export function CopyButton({ value, label = 'Copy', subtle }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard API needs a secure context; fall back to a selection copy.
      const el = document.createElement('textarea');
      el.value = value;
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
      aria-label={label}
      title={label}
      className={
        subtle
          ? 'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-ink-faint transition hover:bg-surface hover:text-ink'
          : 'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink-muted transition hover:bg-surface-sunken hover:text-ink'
      }
    >
      {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
}
