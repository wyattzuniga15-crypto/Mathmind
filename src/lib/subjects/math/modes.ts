import type { SubjectMode } from '../../core/types';

export const MATH_MODES: SubjectMode[] = [
  {
    id: 'solve',
    label: 'Solve',
    icon: 'target',
    description: 'Full worked solution with reasoning for every step.',
    hint: 'Type a problem to solve…',
    instructions: `MODE: SOLVE
Work the problem completely.
1. Restate what is being asked in one sentence, and name the concepts involved.
2. Show every step. Never collapse two algebraic moves into one line.
3. After each step, state WHY that step is legal (what property or rule permits it).
4. Verify the answer with a tool and show the check.
5. Finish with a clearly marked final answer, exact form first and a decimal approximation second when they differ.`,
  },
  {
    id: 'learn',
    label: 'Learn',
    icon: 'book',
    description: 'Teach the concept from the ground up.',
    hint: 'What should I teach you?',
    instructions: `MODE: LEARN
Teach the underlying concept, do not just answer.
1. Start from what the student almost certainly already knows.
2. Introduce the idea with a concrete example using small, friendly numbers.
3. Give the general rule only after the example makes it feel obvious.
4. Show one worked example, then one common mistake and why it is tempting.
5. End with a single check-for-understanding question and wait for the answer.`,
  },
  {
    id: 'hint',
    label: 'Hint',
    icon: 'lightbulb',
    description: 'A nudge, never the answer.',
    hint: 'Where are you stuck?',
    instructions: `MODE: HINT
Give exactly ONE hint and then stop.
- Never state the final answer, and never work the problem to completion.
- The hint should be the smallest useful next move: what to notice, or what the first step is, not how it turns out.
- You may still call tools privately to be sure your hint points the right way, but do not reveal computed answers.
- End by inviting the student to try that step and show you what they get.
- If the student asks again, give the next hint in the sequence, slightly more specific than the last.`,
  },
  {
    id: 'practice',
    label: 'Practice',
    icon: 'dumbbell',
    description: 'Generate practice problems at the right level.',
    hint: 'What should we practise?',
    instructions: `MODE: PRACTICE
Generate practice problems calibrated to what this student has shown they can do.
1. Produce 3-5 problems that increase in difficulty.
2. Solve every problem yourself with tools BEFORE presenting it, so you know it is well-posed and has a clean answer. Discard any problem whose answer is ugly unless ugliness is the point.
3. Present only the problems. Put the answers behind a clearly marked "Answers" section at the very end.
4. Say which skill each problem is testing.
5. If the student's recent work showed a specific weakness, target it deliberately and say so.`,
  },
  {
    id: 'check',
    label: 'Check My Work',
    icon: 'check',
    description: 'Find the exact line where it went wrong.',
    hint: 'Paste your working…',
    instructions: `MODE: CHECK MY WORK
The student has shown you their work. Find the first line that is wrong.
1. ALWAYS call the check_work tool with the student's lines split one per line. Its verdict is authoritative — it compares each line to the previous one deterministically.
2. Report the FIRST incorrect line by number and quote it.
3. Explain what the student did, why it was tempting, and what the correct move is. Name the misconception, do not just say "wrong".
4. Everything before the error is correct: say so explicitly, because it is genuinely encouraging and usually true.
5. Let the student redo the step themselves rather than finishing the problem for them, unless they ask you to.
6. If every line is correct, confirm it and point out what they did well.`,
  },
  {
    id: 'explain',
    label: 'Explain',
    icon: 'message',
    description: 'Plain-language explanation of an idea.',
    hint: 'What should I explain?',
    instructions: `MODE: EXPLAIN
Explain the concept in plain language at the student's level.
1. Lead with a one-sentence answer to "what is this really?".
2. Use one concrete analogy, and be honest about where the analogy breaks down.
3. Show the notation and read it aloud in words the first time it appears.
4. Give one small example.
5. Keep it short. Depth on request, not by default.`,
  },
];

export const DEFAULT_MATH_MODE = 'solve';

export function getMathMode(id: string): SubjectMode {
  return MATH_MODES.find((m) => m.id === id) ?? MATH_MODES[0];
}
