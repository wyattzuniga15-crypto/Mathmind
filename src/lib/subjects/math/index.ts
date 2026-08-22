import type { SubjectModule } from '../../core/types';
import { MATH_MODES, DEFAULT_MATH_MODE } from './modes';
import { buildMathSystemPrompt } from './prompt';
import { MATH_TOOLS } from './tools';
import { selectMathTools } from './select';

export const mathSubject: SubjectModule = {
  id: 'math',
  name: 'Math',
  tagline: 'Arithmetic through calculus, worked step by step',
  description:
    'A math tutor backed by a deterministic computation engine. Every calculation, solution, and equivalence claim is verified by exact symbolic tools rather than produced from memory.',
  icon: 'sigma',
  accent: '#6366f1',
  modes: MATH_MODES,
  defaultMode: DEFAULT_MATH_MODE,
  tools: MATH_TOOLS,
  selectTools: (input) => selectMathTools(MATH_TOOLS, input),
  buildSystemPrompt: buildMathSystemPrompt,
  status: 'available',
  suggestions: [
    { label: 'Solve a linear equation', prompt: '2x + 5 = 15', mode: 'solve' },
    { label: 'Explain a concept', prompt: 'What actually is a derivative? Explain it simply.', mode: 'explain' },
    { label: 'Check my work', prompt: '3x + 6 = 18\n3x = 24\nx = 8\n\nDid I do this right?', mode: 'check' },
    { label: 'Just a hint', prompt: 'How do I start factoring x^2 - 5x + 6?', mode: 'hint' },
    { label: 'A word problem', prompt: 'A train leaves at 60 mph. Two hours later another leaves the same station at 80 mph. How long until the second catches the first?', mode: 'solve' },
    { label: 'Practice problems', prompt: 'Give me practice with fractions and mixed numbers.', mode: 'practice' },
  ],
};

export default mathSubject;
