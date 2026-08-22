import type { SubjectMode } from '../../core/types';

/**
 * A general assistant doesn't have lesson-plan modes -- it just talks. One
 * mode exists purely because SubjectModule requires at least one and the
 * platform's mode-switching UI is designed to disappear when there's only
 * one to switch between (see Composer.tsx).
 */
export const GENERAL_MODES: SubjectMode[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: 'message-circle',
    description: 'Ask anything.',
    hint: 'Message the assistant…',
    instructions: '',
  },
];

export const DEFAULT_GENERAL_MODE = 'chat';

export function getGeneralMode(id: string): SubjectMode {
  return GENERAL_MODES.find((m) => m.id === id) ?? GENERAL_MODES[0];
}
