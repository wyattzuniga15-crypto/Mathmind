import type { SubjectModule } from '../../core/types';
import { CODE_MODES, DEFAULT_CODE_MODE } from './modes';
import { buildCodeSystemPrompt } from './prompt';

export const codeSubject: SubjectModule = {
  id: 'code',
  name: 'Code',
  tagline: 'Write, debug, and explain code',
  description: 'An AI assistant focused on programming -- writing, debugging, reviewing, and explaining code.',
  icon: 'code',
  accent: '#0ea5e9',
  modes: CODE_MODES,
  defaultMode: DEFAULT_CODE_MODE,
  tools: [],
  buildSystemPrompt: buildCodeSystemPrompt,
  status: 'available',
  suggestions: [
    { label: 'Write a function', prompt: 'Write a Python function that removes duplicate items from a list while preserving order.' },
    { label: 'Debug an error', prompt: "I'm getting \"TypeError: Cannot read properties of undefined\" -- here's the code:\n" },
    { label: 'Explain this code', prompt: 'Explain what this code does, line by line:\n' },
    { label: 'Review my code', prompt: "Review this for bugs and style issues:\n" },
    { label: 'Convert between languages', prompt: 'Convert this Python function to TypeScript:\n' },
    { label: 'Regex help', prompt: 'Write a regex that matches a valid email address, and explain each part.' },
  ],
};

export default codeSubject;
