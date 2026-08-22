'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Lock,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Sigma,
  Trash2,
  X,
} from './icons';
import type { Conversation, StudentLevel } from '@/lib/core/types';

export interface SubjectSummary {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  status: 'available' | 'coming-soon';
}

const LEVELS: { id: StudentLevel; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'elementary', label: 'Elementary' },
  { id: 'middle', label: 'Middle' },
  { id: 'high', label: 'High' },
  { id: 'college', label: 'College' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  subjects: SubjectSummary[];
  activeSubjectId: string;
  onSubjectChange: (id: string) => void;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  level: StudentLevel;
  onLevelChange: (level: StudentLevel) => void;
}

function groupByDate(conversations: Conversation[]) {
  const now = Date.now();
  const day = 86_400_000;
  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Older', items: [] },
  ];
  for (const c of conversations) {
    const age = now - c.updatedAt;
    if (age < day) groups[0].items.push(c);
    else if (age < day * 7) groups[1].items.push(c);
    else groups[2].items.push(c);
  }
  return groups.filter((g) => g.items.length);
}

function ConversationRow({
  conversation,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  conversation: Conversation;
  active: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState(conversation.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpen]);

  const commit = () => {
    const title = draft.trim();
    if (title && title !== conversation.title) onRename(title.slice(0, 80));
    else setDraft(conversation.title);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 rounded-lg bg-surface-sunken px-2 py-1.5">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(conversation.title);
              setEditing(false);
            }
          }}
          onBlur={commit}
          aria-label="Conversation name"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
        />
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={commit} aria-label="Save name">
          <Check size={14} className="text-emerald-500" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex items-center rounded-lg transition ${
        active ? 'bg-brand-soft text-ink' : 'hover:bg-surface-sunken'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 truncate px-2.5 py-2 text-left text-[13px]"
        title={conversation.title}
      >
        {conversation.title}
      </button>
      <button
        type="button"
        aria-label={`Options for ${conversation.title}`}
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((o) => !o);
        }}
        className={`mr-1 rounded p-1 text-ink-faint transition hover:text-ink ${
          menuOpen ? '' : 'opacity-0 focus:opacity-100 group-hover:opacity-100'
        }`}
      >
        <MoreHorizontal size={15} />
      </button>

      {menuOpen && (
        <div className="absolute right-1 top-9 z-20 w-36 overflow-hidden rounded-lg border border-line bg-surface-raised py-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-surface-sunken"
          >
            <Pencil size={13} /> Rename
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onDelete();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-red-500 hover:bg-surface-sunken"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar(props: Props) {
  const {
    open,
    onClose,
    subjects,
    activeSubjectId,
    onSubjectChange,
    conversations,
    activeId,
    onSelect,
    onNew,
    onRename,
    onDelete,
    level,
    onLevelChange,
  } = props;

  const groups = groupByDate(conversations);

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          data-print-hide
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      <aside
        data-print-hide
        className={`fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col border-r border-line bg-surface-raised transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white">
              <Sigma size={16} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">MathMind</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-sunken lg:hidden"
          >
            <X size={17} />
          </button>
        </div>

        <div className="px-3">
          <button
            type="button"
            onClick={onNew}
            className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] font-medium transition hover:border-brand/50 hover:text-brand"
          >
            <MessageSquarePlus size={15} />
            New conversation
          </button>
        </div>

        <div className="px-3 pt-4">
          <p className="mb-1.5 px-1 text-[10.5px] font-semibold uppercase tracking-wider text-ink-faint">
            Subjects
          </p>
          <div className="space-y-0.5">
            {subjects.map((s) => {
              const disabled = s.status !== 'available';
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSubjectChange(s.id)}
                  title={disabled ? 'Coming soon' : s.tagline}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition ${
                    s.id === activeSubjectId
                      ? 'bg-brand-soft font-medium text-brand'
                      : disabled
                        ? 'cursor-not-allowed text-ink-faint'
                        : 'hover:bg-surface-sunken'
                  }`}
                >
                  <Sigma size={14} className="shrink-0" />
                  <span className="flex-1 truncate">{s.name}</span>
                  {disabled && <Lock size={12} />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-3 pt-4">
          <label
            htmlFor="level-select"
            className="mb-1.5 block px-1 text-[10.5px] font-semibold uppercase tracking-wider text-ink-faint"
          >
            Explanation level
          </label>
          <select
            id="level-select"
            value={level}
            onChange={(e) => onLevelChange(e.target.value as StudentLevel)}
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand/60"
          >
            {LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto px-3 pb-4">
          {conversations.length === 0 ? (
            <p className="px-1 py-3 text-[12.5px] text-ink-faint">
              No conversations yet. Ask a question to start one.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="mb-1 px-1 text-[10.5px] font-semibold uppercase tracking-wider text-ink-faint">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((c) => (
                    <ConversationRow
                      key={c.id}
                      conversation={c}
                      active={c.id === activeId}
                      onSelect={() => onSelect(c.id)}
                      onRename={(title) => onRename(c.id, title)}
                      onDelete={() => onDelete(c.id)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
