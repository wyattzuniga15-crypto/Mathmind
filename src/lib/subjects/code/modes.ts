import type { SubjectMode } from '../../core/types';

/** One mode, same reasoning as the general subject: nothing to switch between. */
export const CODE_MODES: SubjectMode[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: 'code',
    description: 'Write, debug, and explain code.',
    hint: 'Paste code or describe what you need…',
    instructions: '',
  },
];

export const DEFAULT_CODE_MODE = 'chat';

export function getCodeMode(id: string): SubjectMode {
  return CODE_MODES.find((m) => m.id === id) ?? CODE_MODES[0];
}
