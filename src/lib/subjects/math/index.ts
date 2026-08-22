import type { SubjectModule } from '../../core/types';
import { GENERAL_MODES, DEFAULT_GENERAL_MODE } from './modes';
import { buildGeneralSystemPrompt } from './prompt';
import { MATH_TOOLS } from './tools';
import { selectMathTools } from './select';

/**
 * The default, general-purpose subject. Despite the folder name (kept to
 * avoid moving the math engine and its extensive test suite), this is not a
 * math-only mode -- it's a normal AI assistant that happens to carry an
 * exact computation engine, so arithmetic, equations, and statistics it
 * touches are verified rather than guessed.
 */
export const generalSubject: SubjectModule = {
  id: 'general',
  name: 'Chat',
  tagline: 'Ask anything',
  description:
    'A general-purpose AI assistant. Math and calculations are checked by an exact symbolic engine rather than produced from memory; everything else is a normal conversation.',
  icon: 'message-circle',
  accent: '#4f46e5',
  modes: GENERAL_MODES,
  defaultMode: DEFAULT_GENERAL_MODE,
  tools: MATH_TOOLS,
  selectTools: (input) => selectMathTools(MATH_TOOLS, input),
  buildSystemPrompt: buildGeneralSystemPrompt,
  status: 'available',
  suggestions: [
    { label: 'Explain something', prompt: 'Explain how compound interest works, simply.' },
    { label: 'Write for me', prompt: 'Write a short, friendly email asking to reschedule a meeting.' },
    { label: 'Quick math', prompt: 'What is 15% of 340, and what is 3/4 + 1/6 exactly?' },
    { label: 'Help me decide', prompt: "I'm choosing between two job offers. What should I actually weigh?" },
    { label: 'Solve an equation', prompt: '2x + 5 = 15' },
    { label: 'Just talk', prompt: "What's an interesting idea you think more people should know about?" },
  ],
};

export default generalSubject;
